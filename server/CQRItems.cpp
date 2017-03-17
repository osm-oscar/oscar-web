#include "CQRItems.h"
#include <cppcms/http_response.h>
#include <cppcms/http_request.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>
#include <cppcms/json.h>
#include <cppcms/util.h>
#include <sserialize/spatial/CellQueryResult.h>

namespace oscar_web {

CQRItems::CQRItems(cppcms::service& srv, const CompletionFileDataPtr& dataPtr):
cppcms::application(srv),
m_dataPtr(dataPtr)
{
	dispatcher().assign("/items/all", &CQRItems::all, this);
}

CQRItems::~CQRItems() {}

void CQRItems::all() {
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
	bool withShapes = sserialize::toBool(request().get("s"));
	bool withParents = sserialize::toBool(request().get("p"));

	sserialize::CellQueryResult cqr;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		cqr = m_dataPtr->completer->cqrComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->treedCQR);
	}
	else {
		cqr = m_dataPtr->completer->cqrComplete(cqs, m_dataPtr->treedCQR);
	}
	uint32_t itemCount = 0;
	
	std::ostream & out = response().out();
	if (withParents) {
		
	}
	else {
		sserialize::ItemIndex itemIds = cqr.flaten();
		out << "[";
		m_serializer.toJson(out, store.id2ItemIterator(itemIds.begin()), store.id2ItemIterator(itemIds.end()), withShapes);
		out << "]";
	}
	
	ttm.end();
	writeLogStats("simpleCQR", cqs, ttm, cqr.cellCount(), itemCount);
}

void CQRItems::writeLogStats(const std::string& fn, const std::string& query, const sserialize::TimeMeasurer& tm, uint32_t cqrSize, uint32_t idxSize) {
	*(m_dataPtr->log) << "CQRItems::" << fn << ": t=" << tm.beginTime() << "s, rip=" << request().remote_addr() << ", q=[" << query << "], rs=" << cqrSize <<  " is=" << idxSize << ", ct=" << tm.elapsedMilliSeconds() << "ms" << std::endl;
}


}//end namespace oscar_web