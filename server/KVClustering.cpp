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

	//count all key value pairs like described in BA_Benjamin_Kopf_2017 4.1
	//keyMap has the key as key and an (unordered_map, int) pair as value. the unordered_pair contains the values and the count of each value. the int counts in how many items the key is present.
	auto keyMap = std::unordered_map<std::string, std::pair<std::unordered_map<std::string, uint32_t>, uint32_t >>();

	//iterate over all query result items
	for(sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it){
		for(uint32_t x : it.idx()) {
			auto item = store.at(x);
			//iterate over all item keys
			for (uint32_t i = 0; i < item.size(); ++i) {
			    auto keySearch = keyMap.find(item.key(i));
			    if(keySearch == keyMap.end()){
			        //key is not present in keyMap
                    auto valueMap = std::unordered_map<std::string, uint32_t>();
                    auto keyMapPair = std::make_pair(item.key(i), std::make_pair(valueMap, 1));
                    keyMap.emplace(keyMapPair);
			    } else {
			        //key is present
			        //increment key count
                    (keySearch -> second).second++;
			    }
			    //fetch the updated key
			    keySearch = keyMap.find(item.key(i));

			    //try to find the value in the valueMap
			    auto valueSearch = keySearch -> second.first.find(item.value(i));
			    if(valueSearch != keySearch -> second.first.end()){
			        //value found -> increment count
			    	valueSearch -> second++;
			    }
			    else{
			        //value not found -> insert it
			    	auto valueCountPair = std::make_pair(item.value(i), 1);
                    keySearch -> second.first.emplace(valueCountPair);
			    }
			}
		}
	}

	struct keyCountComparator
    {
        bool operator() (const std::pair<std::string, std::pair<std::unordered_map<std::string, uint32_t>, uint32_t>>& v1,
                const std::pair<std::string, std::pair<std::unordered_map<std::string, uint32_t>, uint32_t>>& v2){
            return (v1.second.second > v2.second.second);
        }
    };

	//putting the map into a vector and sort
	std::vector<std::pair<std::string, std::pair<std::unordered_map<std::string, uint32_t>, uint32_t>>> elems(keyMap.begin(), keyMap.end());
	std::sort(elems.begin(), elems.end(), keyCountComparator());

	//returning result in json
    out << "{\"kvclustering\":[";
    bool first0 = true;
	for(auto it : elems){
        if(it.second.second > itemCount*0.1f && it.second.second > 1) {
            if (!first0) out << ",";
            first0 = false;
            out << "{";
            out << "\"name\":" << '"' << escapeJsonString(it.first) << '"' << ',' << " \"count\" : " << it.second.second << ","
                << "\"clValues\" :" << "[";
            std::int32_t others = 0;
            bool first = true;
            for (auto ite : it.second.first) {
                if (ite.second > it.second.second * 0.1f) {
                    if (!first) out << ",";
                    first = false;
                    out << R"({"name":")" << escapeJsonString(ite.first) << '"' << "," << "\"count\":" << ite.second << "}";
                } else {
                    others += ite.second;
                }
            }
            if(others > 0){
                if (!first) out << ",";
                out << R"({"name":")" << "others" << '"' << "," << "\"count\":" << others << "}";
            }

            out << "]}";
        }
	}
	out << "]}";

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
