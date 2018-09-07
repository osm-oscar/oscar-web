#include "KVClustering.h"
#include <cppcms/http_response.h>
#include <cppcms/http_request.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>
#include <cppcms/json.h>
#include <cppcms/util.h>
#include <sserialize/spatial/CellQueryResult.h>
#include <boost/algorithm/string/replace.hpp>

namespace oscar_web {

	KVClustering::KVClustering(cppcms::service& srv, const CompletionFileDataPtr& dataPtr):
	cppcms::application(srv),
	m_dataPtr(dataPtr)
	{
		dispatcher().assign("/get", &KVClustering::get, this);
		mapper().assign("get","/get");
	}

	KVClustering::~KVClustering() {}

	void KVClustering::get() {
	typedef sserialize::Static::spatial::GeoHierarchy GeoHierarchy;
	typedef liboscar::Static::OsmKeyValueObjectStore OsmKeyValueObjectStore;

	sserialize::TimeMeasurer ttm;
	ttm.begin();

	const auto & store = m_dataPtr->completer->store();
	const auto & gh = store.geoHierarchy();

	response().set_content_header("text/json");


	//params
	std::string cqs = request().get("q");
	std::string regionFilter = request().get("rf");
	std::string format = request().get("format");
	std::string clusteringType = request().get("type");
	std::string queryId = request().get("queryId");

	sserialize::CellQueryResult cqr;
	sserialize::spatial::GeoHierarchySubGraph sg;

	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		sg = m_dataPtr->ghSubSetCreators.at(regionFilter);
	}
	else {
		sg = m_dataPtr->completer->ghsg();
	}
	cqr = m_dataPtr->completer->cqrComplete(cqs, sg, m_dataPtr->treedCQR);
	uint32_t itemCount = cqr.maxItems();



	std::ostream & out = response().out();



    if(clusteringType == "kv"){
		auto keyValueCountMap = std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t>();

		auto keyCountMap = std::unordered_map<std::uint32_t, std::uint32_t>();

		auto keyValueMap = std::unordered_map<std::uint32_t, std::vector<uint32_t>>();

    	kvClustering(keyValueCountMap, keyValueMap, keyCountMap, cqr);

		generateKvOutput(out, keyValueMap, keyCountMap, keyValueCountMap, itemCount);
    }

    else if(clusteringType == "p"){
		auto parentKeyMap = std::unordered_map<std::uint32_t, std::set<uint32_t>>();

		//get all parents and their items

		for(sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it) {
			auto cellParents = sg.cellParents(it.cellId());
			if (!cellParents.empty()) {
				auto itP = cellParents.begin();
				auto endP = cellParents.end();
				for(; itP != endP; ++itP) {
					for(uint32_t x : it.idx()){
						auto item = store.at(x);
						parentKeyMap[*itP].insert(item.id());
					}
				}
			}
		}

		//transform parentKeyMap to vector and sort descending by number of keys

		std::vector<std::pair<std::uint32_t,std::set<uint32_t>>> parentKeyVec;

		std::copy(parentKeyMap.begin(), parentKeyMap.end(), std::back_inserter<std::vector<std::pair<std::uint32_t,std::set<uint32_t>>>>(parentKeyVec));

		std::sort(parentKeyVec.begin(), parentKeyVec.end(), [](std::pair<std::uint32_t,std::set<uint32_t>> const & a, std::pair<std::uint32_t,std::set<uint32_t>> const & b)
		{
			return a.second.size() != b.second.size()?  a.second.size() > b.second.size() : a.first < b.first;
		});

		//begin printing

		out << "{\"parentClustering\":[";

		getParentsWithNoIntersection(parentKeyVec, out);

		out << "]";
    }

    out << ",\"queryId\":" + queryId + "}";

	ttm.end();
	writeLogStats("get", cqs, ttm, cqr.cellCount(), itemCount);
}

	void KVClustering::writeLogStats(const std::string& fn, const std::string& query, const sserialize::TimeMeasurer& tm, uint32_t cqrSize, uint32_t idxSize) {
	*(m_dataPtr->log) << "KVClustering::" << fn << ": t=" << tm.beginTime() << "s, rip=" << request().remote_addr() << ", q=[" << query << "], rs=" << cqrSize <<  " is=" << idxSize << ", ct=" << tm.elapsedMilliSeconds() << "ms" << std::endl;
}

	void KVClustering::kvClustering(
		std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t> &keyValueCountMap,
		std::unordered_map<std::uint32_t, std::vector<uint32_t>> &keyValueMap,
		std::unordered_map<std::uint32_t, std::uint32_t> &keyCountMap,
		const sserialize::CellQueryResult& cqr) {
		//iterate over all query result items
		const auto & store = m_dataPtr->completer->store();
		for(sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it){
			for(uint32_t x : it.idx()) {
				auto item = store.at(x);
				//iterate over all item keys
				for (uint32_t i = 0; i < item.size(); ++i) {
					uint32_t key = item.keyId(i);
					uint32_t value = item.valueId(i);
					auto keyValuePair = std::make_pair(key, value);
					//make_pair is faster
					//uint64_t keyValuePair = ((uint64_t)item.keyId(i)) << 32;
					//keyValuePair += item.valueId(i);
					auto keyValueSearch = keyValueCountMap.find(keyValuePair);
					if(keyValueSearch == keyValueCountMap.cend())
						keyValueMap[key].push_back(value);

					keyValueCountMap[keyValuePair]++;

					keyCountMap[key]++;

				}
			}
		}

	}

	void KVClustering::generateKvOutput(std::ostream & out,
			std::unordered_map<std::uint32_t, std::vector<uint32_t>> keyValueMap,
			std::unordered_map<std::uint32_t, std::uint32_t> keyCountMap,
			std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t> keyValueCountMap,
			std::uint32_t itemCount) {
		sserialize::JsonEscaper je;
		const auto & store = m_dataPtr->completer->store();
		out << "{\"kvclustering\":[";
		bool first0 = true;
		for(const auto &keyValue : keyValueMap){
			uint32_t keyId = keyValue.first;
			std::vector<uint32_t> valueVector = keyValue.second;
			std::uint32_t keyCount = keyCountMap[keyId];
			if (keyCount > itemCount*0.1f && keyCount > 1) {
				if (!first0) out << ",";
				first0 = false;
				out << "{";
				out << "\"name\":" << '"' << je.escape(store.keyStringTable().at(keyId)) << '"' << ',' << " \"count\" : " << keyCountMap.at(keyId) << ","
					<< "\"clValues\" :" << "[";
				std::int32_t others = 0;

				bool first = true;

				for(uint32_t valueId: valueVector){
					auto keyValuePair = std::make_pair(keyId, valueId);
					uint32_t valueCount = keyValueCountMap.at(keyValuePair);
					if(valueCount > keyCount*0.1f){
						if (!first) out << ",";
						first = false;
						out << R"({"name":")" << je.escape(store.valueStringTable().at(valueId)) << '"' << "," << "\"count\":" << valueCount << "}";
					} else {
						others += valueCount;
					}
				}
				if(others > 0){
					if (!first) out << ",";
					out << R"({"name":")" << "others" << '"' << "," << "\"count\":" << others << "}";
				}
				out << "]}";
			}
		}
        out << "]";


	}

	bool KVClustering::hasIntersection(const std::set<uint32_t>& set1, const std::set<uint32_t>& set2){
		auto itSet1 = set1.begin();
		auto itSet2 = set2.begin();
		while (itSet1!=set1.end() && itSet2!=set2.end())
		{
			if (*itSet1<*itSet2) ++itSet1;
			else if (*itSet2<*itSet1) ++itSet2;
			else {
				return true;
			}
		}
		return false;
	}

	void KVClustering::getParentsWithNoIntersection(
			const std::vector<std::pair<std::uint32_t, std::set<uint32_t>>> &parentKeyVec,
			std::ostream &out) {
		//derive startParents BA-Kopf Page 18
		auto result = std::vector<std::pair<uint32_t , std::set<uint32_t >>>();
		auto itI = parentKeyVec.begin()+1;
		bool startParentsFound = false;
		for(itI; itI != parentKeyVec.end(); ++itI) {
			for (auto itJ = parentKeyVec.begin(); itJ != itI; ++itJ) {
				std::uint32_t parentI = (*itI).first;
				std::uint32_t parentJ = (*itJ).first;
				std::set<uint32_t> setI = (*itI).second;
				std::set<uint32_t> setJ = (*itJ).second;
				if (!hasIntersection(setI, setJ)) {
					//no intersection add both parents to results and print them
					result.emplace_back(parentJ, setJ);
					auto parentId = parentJ;
					auto itemCount = setJ.size();
					printParent(parentId, itemCount, out);

					result.emplace_back(parentI, setI);
					parentId = parentI;
					itemCount = setI.size();
					out << ",";
					printParent(parentId, itemCount, out);

					//end the algorithm
					startParentsFound = true;
					break;
				}
			}
			if(startParentsFound)
				break;
		}
		//get other parents which don't have an intersection with the startParents(BA-Kopf page 19)
		if(startParentsFound){
			for(auto itK = itI+1; itK != parentKeyVec.end(); ++itK){
				bool discarded = false;
				for(auto parentPair : result){
					if(hasIntersection((*itK).second, parentPair.second)){
						discarded = true;
						break;
					}
				}
				if(!discarded){
					//parent does not intersect with previous found parents; add to results and print
					result.emplace_back(*itK);
					auto parentId = (*itK).first;
					auto itemCount = (*itK).second.size();
					out << ",";
					printParent(parentId, itemCount, out);
				}
			}
		}


	}

	void KVClustering::printParent(const uint32_t& parentId, const long& itemCount, std::ostream &out) {
		const auto & store = m_dataPtr->completer->store();
        const auto & gh = store.geoHierarchy();
		sserialize::JsonEscaper je;
		out << "{\"parentName\": \"" << je.escape(store.at(gh.ghIdToStoreId(parentId)).value("name"))  << "\", \"itemCount\":" << itemCount
		 << ",\"cellId\":" << parentId << "}";
	}


}//end namespace oscar_web
