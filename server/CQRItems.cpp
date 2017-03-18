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
	dispatcher().assign("/all", &CQRItems::all, this);
	mapper().assign("all","/all");
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
	sserialize::spatial::GeoHierarchySubGraph sg;
	
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		sg = m_dataPtr->ghSubSetCreators.at(regionFilter);
	}
	else {
		sg = m_dataPtr->completer->ghsg();
	}
	cqr = m_dataPtr->completer->cqrComplete(cqs, sg, m_dataPtr->treedCQR);
	uint32_t itemCount = 0;
	
	std::ostream & out = response().out();
	out << "[";
	if (withParents) {
		std::unordered_set<uint32_t> tmp;
		bool haveParents = false;
		int32_t max_write_items = m_dataPtr->maxResultDownloadSize;
		{
			for(sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it) {
				auto cellParents = sg.cellParents(it.cellId());
				tmp.insert(cellParents.cbegin(), cellParents.cend());
			}
			std::vector<uint32_t> parents(tmp.size());
			{
				uint32_t i = 0;
				for(uint32_t x : tmp) {
					parents[i] = gh.ghIdToStoreId(x);
					++i;
				}
			}
			haveParents = parents.size();
			if (parents.size() > max_write_items) {
				m_serializer.toJson(out,
									store.id2ItemIterator(parents.cbegin()),
									store.id2ItemIterator(parents.cend()+max_write_items),
									withShapes);
				max_write_items = 0;
			}
			else {
				m_serializer.toJson(out, store.id2ItemIterator(parents.cbegin()), store.id2ItemIterator(parents.cend()), withShapes);
				max_write_items -= parents.size();
			}
		}
		if (haveParents && max_write_items > 0) { //now take care of the items
			tmp.clear();
			for(sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it) {
				std::string parentString;
				{
					auto cellParents = sg.cellParents(it.cellId());
					std::stringstream ss;
					ss << "\"p\":[";
					if (cellParents.size()) {
						auto it = cellParents.begin();
						auto end = cellParents.end();
						ss << gh.ghIdToStoreId(*it);
						for(++it; it != end; ++it) {
							ss << ',' << gh.ghIdToStoreId(*it);
						}
					}
					ss << ']';
					parentString = ss.str();
				}
				for(uint32_t x : it.idx()) {
					auto shapeType = store.geoShapeType(x);
					if (shapeType != sserialize::spatial::GS_POINT) {
						if (tmp.count(x)) {
							continue;
						}
						tmp.insert(x);
					}
					auto item  = store.at(x);
					out << ',';
					m_serializer.toJson(out, item, withShapes, parentString);
					max_write_items -= 1;
					if (max_write_items <= 0) {
						break;
					}
				}
				if (max_write_items <= 0) {
					break;
				}
			}
		}
		else {
			sserialize::ItemIndex itemIds = cqr.flaten();
			if (max_write_items > itemIds.size()) {
				m_serializer.toJson(out, store.id2ItemIterator(itemIds.begin()), store.id2ItemIterator(itemIds.end()), withShapes);
			}
			else {
				m_serializer.toJson(out, store.id2ItemIterator(itemIds.begin()), max_write_items, withShapes);
			}
		}
	}
	else {
		sserialize::ItemIndex itemIds = cqr.flaten();
		m_serializer.toJson(out, store.id2ItemIterator(itemIds.begin()), store.id2ItemIterator(itemIds.end()), withShapes);
	}
	out << "]";
	
	ttm.end();
	writeLogStats("simpleCQR", cqs, ttm, cqr.cellCount(), itemCount);
}

void CQRItems::writeLogStats(const std::string& fn, const std::string& query, const sserialize::TimeMeasurer& tm, uint32_t cqrSize, uint32_t idxSize) {
	*(m_dataPtr->log) << "CQRItems::" << fn << ": t=" << tm.beginTime() << "s, rip=" << request().remote_addr() << ", q=[" << query << "], rs=" << cqrSize <<  " is=" << idxSize << ", ct=" << tm.elapsedMilliSeconds() << "ms" << std::endl;
}


}//end namespace oscar_web