#include "KVClustering.h"
#include <cppcms/http_response.h>
#include <cppcms/http_request.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>
#include <cppcms/json.h>
#include <cppcms/util.h>
#include <sserialize/spatial/CellQueryResult.h>

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

	for(auto it : keyMap){
	    if(it.second.second > itemCount * 0.1f){
            out << (it.first) << "{" << it.second.second << "}" << ":" << "[";
            for(auto ite : it.second.first){
                out << "(" << (ite.first) << "," << (ite.second) << ")";
            }
            out << "]";
	    }
	}

	ttm.end();
	writeLogStats("get", cqs, ttm, cqr.cellCount(), itemCount);
}

void KVClustering::writeLogStats(const std::string& fn, const std::string& query, const sserialize::TimeMeasurer& tm, uint32_t cqrSize, uint32_t idxSize) {
	*(m_dataPtr->log) << "CQRItems::" << fn << ": t=" << tm.beginTime() << "s, rip=" << request().remote_addr() << ", q=[" << query << "], rs=" << cqrSize <<  " is=" << idxSize << ", ct=" << tm.elapsedMilliSeconds() << "ms" << std::endl;
}


}//end namespace oscar_web
