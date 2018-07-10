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

	uint32_t n = 0;
	

	
	std::ostream & out = response().out();

	auto keyValueMap = std::unordered_map<std::uint64_t, std::uint32_t>();



	//iterate over all query result items
	for(sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it){
		for(uint32_t x : it.idx()) {
			auto item = store.at(x);
			//iterate over all item keys
			for (uint32_t i = 0; i < item.size(); ++i) {
			    //combine two ids into one
			    uint32_t  key = item.keyId(i);
			    uint32_t value = item.valueId(i);
			    uint64_t  keyValue = ((uint64_t)item.keyId(i)) << 32;
			    keyValue += item.valueId(i);


			    std::unordered_map<std::uint64_t, std::uint32_t>::const_iterator keyValueSearch = keyValueMap.find(keyValue);
			    if(keyValueSearch == keyValueMap.end()){
			        //keyValue is not present in keyValueMap
                    auto keyValueMapPair = std::make_pair(keyValue, 0);
                    keyValueMap.emplace(keyValueMapPair);
			    } else {
			        //key is present
			        //increment keyValue count
                    keyValueSearch++;
			    }
			}
		}
	}

	auto keyMap = std::unordered_map<std::uint32_t, std::pair<std::uint32_t, std::vector<std::pair<std::uint32_t, std::uint32_t >>>>();

	for(auto keyValue : keyValueMap){
		auto value = (uint32_t) keyValue.first;
		auto key = static_cast<uint32_t>(keyValue.first >> 32);
		uint32_t keyValueCount = keyValue.second;
		std::unordered_map<std::uint32_t, std::pair<std::uint32_t, std::vector<std::pair<std::uint32_t, std::uint32_t >>>>::const_iterator keySearch = keyMap.find(key);
		if(keySearch == keyMap.cend()){
		    auto valueVector = std::vector<std::pair<std::uint32_t, std::uint32_t >>();
		    valueVector.push_back(std::make_pair(value, keyValueCount));
		    auto keyMapPair = std::make_pair(key, std::make_pair(keyValueCount, valueVector));
		}
	}


	ttm.end();
	writeLogStats("get..", cqs, ttm, cqr.cellCount(), itemCount);
}


	//ecapes strings for json, source: https://stackoverflow.com/questions/7724448/simple-json-string-escape-for-c/33799784#33799784

	std::string KVClustering::escapeJsonString(const std::string& input) {
		std::ostringstream ss;
		for (auto iter = input.cbegin(); iter != input.cend(); iter++) {
			//C++98/03:
			//for (std::string::const_iterator iter = input.begin(); iter != input.end(); iter++) {
			switch (*iter) {
				case '\\': ss << "\\\\"; break;
				case '"': ss << "\\\""; break;
				case '/': ss << "\\/"; break;
				case '\b': ss << "\\b"; break;
				case '\f': ss << "\\f"; break;
				case '\n': ss << "\\n"; break;
				case '\r': ss << "\\r"; break;
				case '\t': ss << "\\t"; break;
				default: ss << *iter; break;
			}
		}
		return ss.str();
	}

void KVClustering::writeLogStats(const std::string& fn, const std::string& query, const sserialize::TimeMeasurer& tm, uint32_t cqrSize, uint32_t idxSize) {
	*(m_dataPtr->log) << "CQRItems::" << fn << ": t=" << tm.beginTime() << "s, rip=" << request().remote_addr() << ", q=[" << query << "], rs=" << cqrSize <<  " is=" << idxSize << ", ct=" << tm.elapsedMilliSeconds() << "ms" << std::endl;
}




}//end namespace oscar_web
