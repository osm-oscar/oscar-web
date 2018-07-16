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

	auto keyValueCountMap = std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t>();

	auto keyCountMap = std::unordered_map<std::uint32_t, std::uint32_t>();

	auto keyValueMap = std::unordered_map<std::uint32_t, std::vector<uint32_t>>();


	//iterate over all query result items
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
            out << "\"name\":" << '"' << escapeJsonString(store.keyStringTable().at(keyId)) << '"' << ',' << " \"count\" : " << keyCountMap.at(keyId) << ","
                << "\"clValues\" :" << "[";
            std::int32_t others = 0;

            bool first = true;

            for(uint32_t valueId: valueVector){
                auto keyValuePair = std::make_pair(keyId, valueId);
                uint32_t valueCount = keyValueCountMap.at(keyValuePair);
                if(valueCount > keyCount*0.1f){
                    if (!first) out << ",";
                    first = false;
                    out << R"({"name":")" << escapeJsonString(store.valueStringTable().at(valueId)) << '"' << "," << "\"count\":" << valueCount << "}";
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

    out << "], \"queryId\":" + queryId + "}";

	ttm.end();
	writeLogStats("get:", cqs, ttm, cqr.cellCount(), items.size());
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
	*(m_dataPtr->log) << "KVClustering::" << fn << ": t=" << tm.beginTime() << "s, rip=" << request().remote_addr() << ", q=[" << query << "], rs=" << cqrSize <<  " is=" << idxSize << ", ct=" << tm.elapsedMilliSeconds() << "ms" << std::endl;
}




}//end namespace oscar_web
