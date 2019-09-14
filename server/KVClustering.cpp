#include "KVClustering.h"
#include "helpers.h"
#include <cppcms/http_response.h>
#include <cppcms/http_request.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>
#include <liboscar/KVClustering.h>
#include <liboscar/KoMaClustering.h>

namespace oscar_web {


KVClustering::KVClustering(cppcms::service &srv, const CompletionFileDataPtr &dataPtr) :
BaseApp(srv, dataPtr, "KVClustering")
{
	dispatcher().assign("/get", &KVClustering::get, this);
	mapper().assign("get", "/get");
}

KVClustering::~KVClustering() = default;

void KVClustering::get() {
	auto irId = genIntReqId("get");
	
	typedef sserialize::Static::spatial::GeoHierarchy GeoHierarchy;
	typedef liboscar::Static::OsmKeyValueObjectStore OsmKeyValueObjectStore;

	sserialize::TimeMeasurer ttm;
	ttm.begin();

	m_store = d().completer->store();
	const auto &gh = m_store.geoHierarchy();

	response().set_content_header("text/json");


	//params
	std::string cqs = request().get("q");
	std::string regionFilter = request().get("rf");
	std::string format = request().get("format");
	// either "p", "kv" or "k"
	std::string clusteringType = request().get("type");
	//the queryId which will be returned
	std::string queryId = request().get("queryId");
	//number of refinements to be returned
	std::string maxRefinements = request().get("maxRefinements");
	//array with either keyNames or key-valuesNames(key:value)
	std::string exceptionsString = request().get("exceptions");
	// array with prefixes
	std::string keyExceptions = request().get("keyExceptions");
	// array with facet sizes
	std::string dynFacetSizeString = request().get("facetSizes");
	// default facetSize
	std::string defaultFacetSizeString = request().get("defaultFacetSize");
	bool parsingCorrect = false;

	bool debug = request().get("debug") == "true";

	m_mode = 0;
	if (clusteringType == "f")
		m_mode = 2;
	if (clusteringType == "p") {
		m_mode = 3;
	}

	sserialize::CellQueryResult cqr;
	sserialize::spatial::GeoHierarchySubGraph sg;

	if (d().ghSubSetCreators.count(regionFilter)) {
		sg = d().ghSubSetCreators.at(regionFilter);
	} else {
		sg = d().completer->ghsg();
	}
	cqr = d().completer->cqrComplete(cqs, sg, d().treedCQR, d().treedCQRThreads);
	auto items = cqr.flaten(d().treedCQRThreads);
	m_itemCount = cqr.maxItems();
	std::ostream &out = response().out();
	m_numberOfRefinements = static_cast<uint32_t>(std::stoi(maxRefinements));
	m_debugStr = std::stringstream();
	m_outStr = std::stringstream();
	m_debugStr << R"(,"debugInfo":{"itemCount":)" << m_itemCount;

	auto subSet = sg.subSet(cqr, false, 1);

	if (m_mode < 3) {
		// key value or key clustering

		//transform exception ranges parameter
		const std::vector<std::string> &prefixKeyExceptions = parseJsonArray<std::string>(keyExceptions, parsingCorrect);
		const std::vector<std::vector<uint32_t>> &exceptionsVecs = parseJsonArray<std::vector<uint32_t>>(
				exceptionsString, parsingCorrect);
		m_debugStr << R"(,"parsingCorrect":")" << parsingCorrect << '"';
		//transform exception parameter

		liboscar::kvclustering::KeyValueExclusions keyValueExclusions(m_store.keyStringTable(),m_store.valueStringTable());
		liboscar::kvclustering::KeyExclusions keyExclusions(m_store.keyStringTable());
		for (const auto &prefixException : prefixKeyExceptions) {
			keyExclusions.addPrefix(prefixException);
		}

		keyExclusions.preprocess();

		for (const auto &exceptionVec : exceptionsVecs) {
			const uint32_t &keyId = exceptionVec[0];
			const uint32_t &valueId = exceptionVec[1];

			keyValueExclusions.add(keyId, valueId);
		}

		liboscar::KoMaClustering koMaClustering(m_store, items, keyExclusions, keyValueExclusions, d().treedCQRThreads);

		sserialize::TimeMeasurer gtm;
		gtm.begin();
		koMaClustering.preprocess();
		gtm.end();
		m_debugStr << ",\"timeToGenerateMap\":" << gtm.elapsedMilliSeconds();

		m_outStr << "{\"clustering\":[";
		bool hasMore = false;
		auto topKeyValues = koMaClustering.topKeyValues(m_numberOfRefinements+1);
		hasMore = topKeyValues.size() > m_numberOfRefinements;
		if(m_mode == 0){
			auto separator = "";
			uint32_t i = 0;
			for ( auto& result : topKeyValues){
				m_outStr << separator;
				printResult(std::make_pair(result.ki.keyId, result.vi.valueId), result.ki.keyStats);
				separator = ",";
				++i;
				if(i==m_numberOfRefinements)
					break;
			}
		} else {
			defaultFacetSize = std::stoi(defaultFacetSizeString);
			std::vector<std::vector<uint32_t>> dynFacetSizeVector = parseJsonArray<std::vector<uint32_t>>(dynFacetSizeString, parsingCorrect);

			dynFacetSize = std::map<std::uint32_t, std::uint32_t>();
			for(auto keySizePair : dynFacetSizeVector) {
				dynFacetSize[keySizePair[0]] = keySizePair[1]+1;
			}
			auto separator = "";
			const auto& facets = koMaClustering.facets(m_numberOfRefinements+1, dynFacetSize, defaultFacetSize+1);
			uint32_t k = 0;
			for(auto& result : facets) {
				if(m_numberOfRefinements <= k)
					break;
				m_outStr << separator;
				auto& itemId = result.first;
				auto& valueList = result.second;
				printFacet(itemId, valueList);
				separator = ",";
				++k;
			}
			hasMore = facets.size() > m_numberOfRefinements;
		}

		m_outStr << "]";
		m_outStr << ",\"hasMore\":" << std::boolalpha << hasMore;
	} else {
		sserialize::TimeMeasurer gtm;
		gtm.begin();
		std::unordered_map<std::uint32_t, std::vector<uint32_t>> parentItemMap;
		std::vector<std::pair<std::uint32_t, std::uint32_t >> parentItemPairVec;
		std::unordered_map<std::uint32_t, std::uint32_t> parentItemCountMap;
		//get all parents and their itemCounts
		for (sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it) {
			const auto &cellParents = sg.cellParents(it.cellId());
			if (!cellParents.empty()) {
				for (const uint32_t &cellParent : cellParents) {
					parentItemCountMap[cellParent] += it.idxSize();
				}
			}
		}
		gtm.end();
		m_debugStr << ",\"timeToGenerateMap\":" << gtm.elapsedMilliSeconds();
		sserialize::TimeMeasurer ctm;
		ctm.begin();
		std::vector<std::pair<std::uint32_t, std::uint32_t >> parentItemVec;
		for (const auto &parentItemCountPair : parentItemCountMap) {
			parentItemVec.emplace_back(parentItemCountPair);
		}
		sserialize::TimeMeasurer stm;
		stm.begin();
		std::sort(parentItemVec.begin(), parentItemVec.end(), [](std::pair<std::uint32_t, std::uint32_t> const &a,
				 std::pair<std::uint32_t, std::uint32_t> const &b) {
			return a.second != b.second ? a.second > b.second : a.first < b.first;
		});
		stm.end();
		m_debugStr << ",\"timeToSort\":" << stm.elapsedMilliSeconds();
		auto parentCount = static_cast<uint32_t>(parentItemCountMap.size());
		m_debugStr << ",\"parentCount\":" << parentCount;

		writeParentsWithNoIntersection(parentItemMap, parentItemVec, subSet);
	}
	if (debug) {
		ttm.end();
		m_debugStr << ",\"totalTime\":" << ttm.elapsedMilliSeconds();
		m_debugStr << "}";
		m_outStr << m_debugStr.str();
	}

	m_outStr << ",\"queryId\":" + queryId + "}";

	out << m_outStr.str();
	ttm.end();
	log(irId, "get", ttm, cqr);
}

void KVClustering::writeLogStats(const std::string &fn, const std::string &query, const sserialize::TimeMeasurer &tm,
								 uint32_t cqrSize) {
	*(d().log) << "KVClustering::" << fn << ": t=" << tm.beginTime() << "s, rip=0.0.0.0"
					  << ", q=[" << query << "], rs=" << cqrSize << " is=" << m_itemCount << ", ct="
					  << tm.elapsedMilliSeconds() << "ms" << std::endl;
}

//returns true if the number of intersections is greater than minNumber
template<typename It>
bool KVClustering::hasIntersection(It beginI, It endI, It beginJ, It endJ, const std::float_t &minNumber) {
	std::uint32_t intersectionCount = 0;
	while (beginI != endI && beginJ != endJ) {
		if (*beginI < *beginJ) ++beginI;
		else if (*beginJ < *beginI) ++beginJ;
		else {
			++beginI;
			++beginJ;
			if (++intersectionCount > minNumber) {
				return true;
			};
		}
	}
	return false;
}


template<typename mapKey>
void KVClustering::writeParentsWithNoIntersection(const std::unordered_map<mapKey, std::vector<std::uint32_t >> &parentItemMap,
												  const std::vector<std::pair<mapKey, std::uint32_t >> &parentItemVec,
												  sserialize::Static::spatial::detail::SubSet subSet) {


	//derive startParents BA-Kopf Page 18
	sserialize::TimeMeasurer fptm;
	fptm.begin();


	std::vector<std::pair<mapKey, std::uint32_t >> result;
	auto itI = parentItemVec.begin() + 1;
	bool startParentsFound = false;
	std::float_t maxNumberOfIntersections;
	for (; itI < parentItemVec.end(); ++itI) {
		for (auto itJ = parentItemVec.begin(); itJ < itI; ++itJ) {
			const std::vector<uint32_t> &setI = getSet(((*itI).first), parentItemMap, subSet);
			const std::vector<uint32_t> &setJ = getSet(((*itJ).first), parentItemMap, subSet);

			maxNumberOfIntersections =
					m_mode == 3 ? 0 : (setI.size() + setJ.size()) / 200;
			if (!hasIntersection(setI.begin(), setI.end(), setJ.begin(), setJ.end(), maxNumberOfIntersections)) {
				// no intersection or required amount
				// add both parents to results
				result.emplace_back((*itJ).first, (*itJ).second);
				result.emplace_back((*itI).first, (*itI).second);

				//end the algorithm
				startParentsFound = true;
				break;
			}

		}
		if (startParentsFound)
			break;
	}
	fptm.end();
	m_debugStr << ",\"timeToFindFirstParents\":" << fptm.elapsedMilliSeconds();

	//get other parents which don't have an intersection with the startParents(BA-Kopf page 19)
	sserialize::TimeMeasurer nptm;
	nptm.begin();
	if (startParentsFound) {
		for (auto itK = itI + 1; itK < parentItemVec.end() && result.size() < m_numberOfRefinements + 1; ++itK) {
			bool discarded = false;
			for (auto &parentPair : result) {
				maxNumberOfIntersections =
						m_mode == 3 ? 0 : (parentPair.second + (*itK).second) / 200;
				const std::vector<uint32_t> &setI = getSet((*itK).first, parentItemMap, subSet);
				const std::vector<uint32_t> &setJ = getSet(parentPair.first, parentItemMap, subSet);

				if (hasIntersection(setI.begin(), setI.end(), setJ.begin(), setJ.end(), maxNumberOfIntersections)) {
					discarded = true;
					break;
				}
			}
			if (!discarded) {
				//parent does not intersect with previous found parents; add to results
				result.emplace_back(*itK);
			}
		}
	}

	nptm.end();

	m_debugStr << ",\"timeToFindOtherParents\":" << nptm.elapsedMilliSeconds();

	//print results

	m_outStr << "{\"clustering\":[";
	auto separator = "";

	bool hasMore = false;
	uint32_t count = 0;

	for (auto &resultPair: result) {
		if (count < m_numberOfRefinements) {
			m_outStr << separator;
			printResult(resultPair.first, resultPair.second);
			separator = ",";
		} else {
			hasMore = true;
		}
		++count;
	}
	m_outStr << "]";
	m_outStr << ",\"hasMore\":" << std::boolalpha << hasMore;

}

void KVClustering::printResult(const std::uint32_t &id, const long &itemCount) {
	const auto &gh = m_store.geoHierarchy();
	sserialize::JsonEscaper je;

	if (m_mode == 1) {
		m_outStr << R"({"name": ")" << je.escape(m_store.keyStringTable().at(id)) << R"(", "itemCount":)" << itemCount
				 << ",\"id\":" << id << "}";
	} else if (m_mode == 3) {
		m_outStr << R"({"name": ")" << je.escape(m_store.at(gh.ghIdToStoreId(id)).value("name"))
				 << R"(", "itemCount":)" << itemCount
				 << ",\"id\":" << id << "}";
	}
}

void KVClustering::printResult(const std::pair<std::uint32_t, std::uint32_t> &id, const long &itemCount) {
	sserialize::JsonEscaper je;
	m_outStr << R"({"name": ")" << je.escape(m_store.keyStringTable().at(id.first)) << ":"
			 << je.escape(m_store.valueStringTable().at(id.second)) << R"(", "itemCount":)" << itemCount
			 << ",\"keyId\":" << id.first << ",\"valueId\":" << id.second << "}";
}


void KVClustering::insertKey(std::unordered_map<std::uint32_t, std::vector<uint32_t>> &keyItemMap,
							 const liboscar::Static::OsmKeyValueObjectStore::KVItemBase &item,
							 const uint32_t &i,
							 const std::set<uint32_t> &exceptions,
							 const std::vector<std::pair<sserialize::SizeType, sserialize::SizeType>> &keyExceptionRanges,
							 const std::uint32_t &itemId) {
	if (exceptions.find(item.keyId(i)) == exceptions.end())
		keyItemMap[item.keyId(i)].emplace_back(itemId);
}

void KVClustering::insertKey(
		std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::vector<uint32_t>> &keyValueItemMap,
		const liboscar::Static::OsmKeyValueObjectStore::KVItemBase &item,
		const uint32_t &i,
		const std::set<std::pair<uint32_t, uint32_t >> &exceptions,
		const std::vector<std::pair<sserialize::SizeType, sserialize::SizeType>> &keyExceptionRanges,
		const std::uint32_t &itemId) {
	const std::pair<std::uint32_t, std::uint32_t> &keyValuePair = std::make_pair(item.keyId(i), item.valueId(i));
	if (exceptions.find(keyValuePair) == exceptions.end() && !isException(keyValuePair.first, keyExceptionRanges))
		keyValueItemMap[keyValuePair].emplace_back(itemId);
}

bool KVClustering::isException(const std::uint32_t &key,
							   const std::vector<std::pair<sserialize::SizeType, sserialize::SizeType>> &keyExceptionRanges) {
	for (const auto &exceptionRange : keyExceptionRanges) {
		if (key >= exceptionRange.first && key <= exceptionRange.second) {
			return true;
		}
	}
	return false;
}

std::vector<uint32_t> KVClustering::getSet(const std::pair<std::uint32_t, std::uint32_t> &id,
										   const std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::vector<uint32_t >> &map,
										   const sserialize::Static::spatial::detail::SubSet &subSet) {
	return map.at(id);
}

std::vector<uint32_t>
KVClustering::getSet(const uint32_t &id, const std::unordered_map<uint32_t, std::vector<uint32_t >> &map,
					 const sserialize::Static::spatial::detail::SubSet &subSet) {
	if (m_mode < 3) {
		return map.at(id);
	} else {
		const auto &gh = m_store.geoHierarchy();
		return subSet.regionByStoreId(gh.ghIdToStoreId(id))->cellPositions();
	}
}

template<typename iterable>
void KVClustering::printFacet(uint32_t keyId, iterable values) {
	sserialize::JsonEscaper je;
	m_outStr << "{\"key\": " << '"' <<  je.escape(m_store.keyStringTable().at(keyId)) << '"';
	m_outStr << ", \"keyId\": " << keyId;
	m_outStr << ", \"values\" :[";
	auto separator = "";
	size_t i = 0;
	bool hasMore = false;
	size_t facetSize = (dynFacetSize.find(keyId) == dynFacetSize.end()) ? defaultFacetSize : dynFacetSize[keyId];
	for(auto& value : values) {
		m_outStr << separator << "{\"name\":" << '"' << je.escape(m_store.valueStringTable().at(value.first)) << R"(","count":)"
				 << value.second << "}";
		separator = ",";
		++i;
		if(i >= facetSize) {
			hasMore = true;
			break;
		}
	}
	m_outStr << ']';
	m_outStr << ", \"hasMore\":" << std::boolalpha << hasMore;

	m_outStr << '}';
}
}//end namespace oscar_web
