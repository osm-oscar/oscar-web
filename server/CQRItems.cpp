#include "CQRItems.h"
#include "helpers.h"
#include <cppcms/http_response.h>
#include <cppcms/http_request.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>
#include <cppcms/json.h>
#include <cppcms/util.h>
#include <sserialize/spatial/CellQueryResult.h>

namespace oscar_web {

CQRItems::CQRItems(cppcms::service& srv, const CompletionFileDataPtr& dataPtr):
BaseApp(srv, dataPtr, "CQRItems")
{
	dispatcher().assign("/all", &CQRItems::all, this);
	dispatcher().assign("/info", &CQRItems::info, this);
	mapper().assign("all","/all");
}

CQRItems::~CQRItems() {}

void CQRItems::all() {
	typedef sserialize::Static::spatial::GeoHierarchy GeoHierarchy;
	typedef liboscar::Static::OsmKeyValueObjectStore OsmKeyValueObjectStore;
	
	auto irId = genIntReqId("all");
	
	sserialize::TimeMeasurer ttm;
	ttm.begin();

	const auto & store = d().completer->store();
	const auto & gh = store.geoHierarchy();
	
	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().get("q");
	std::string regionFilter = request().get("rf");
	std::string sfstr = request().get("format");

	bool withShapes = sserialize::toBool(request().get("s"));
	bool withItems = request().get("i").empty() || sserialize::toBool(request().get("i"));
	bool withParents = sserialize::toBool(request().get("p"));
	ItemSerializer::SerializationFormat sf = (withShapes ? ItemSerializer::SF_WITH_SHAPE : ItemSerializer::SF_NONE);
	if (sfstr == "geojson") {
		sf = (ItemSerializer::SerializationFormat) (ItemSerializer::SF_GEO_JSON | sf);
	}
	else {
		sf = ItemSerializer::SerializationFormat (ItemSerializer::SF_OSCAR | sf);
	}

	sserialize::CellQueryResult cqr;
	sserialize::spatial::GeoHierarchySubGraph sg;
	
	if (d().ghSubSetCreators.count(regionFilter)) {
		sg = d().ghSubSetCreators.at(regionFilter);
	}
	else {
		sg = d().completer->ghsg();
	}
	cqr = d().completer->cqrComplete(cqs, sg, d().treedCQR);
	
	std::ostream & out = response().out();
	auto streamcfg = m_serializer.streamPrepare(out);
	m_serializer.header(out, sf);
	if (withParents) {
		std::unordered_set<uint32_t> tmp;
		bool haveParents = false;
		int32_t max_write_items = d().maxResultDownloadSize;
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
				using std::sort; //sort for improved disk-access pattern
				sort(parents.begin(), parents.begin()+max_write_items);
				m_serializer.serialize(out,
									store.id2ItemIterator(parents.cbegin()),
									store.id2ItemIterator(parents.cend()+max_write_items),
									sf);
				max_write_items = 0;
			}
			else {
				using std::sort; //sort for improved disk-access pattern
				sort(parents.begin(), parents.end());
				m_serializer.serialize(out, store.id2ItemIterator(parents.cbegin()), store.id2ItemIterator(parents.cend()), sf);
				max_write_items -= parents.size();
			}
		}
		if (withItems && haveParents && max_write_items > 0) { //now take care of the items
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
					m_serializer.serialize(out, item, sf, parentString);
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
		else if (withItems) {
			sserialize::ItemIndex itemIds = cqr.flaten();
			if (max_write_items > itemIds.size()) {
				m_serializer.serialize(out, store.id2ItemIterator(itemIds.begin()), store.id2ItemIterator(itemIds.end()), sf);
			}
			else {
				m_serializer.serialize(out, store.id2ItemIterator(itemIds.begin()), max_write_items, sf);
			}
		}
	}
	else {
		sserialize::ItemIndex itemIds = cqr.flaten();
		if (itemIds.size() > d().maxResultDownloadSize) {
			sserialize::ItemIndex::const_iterator it(itemIds.cbegin());
			for(uint32_t i(0), s(d().maxResultDownloadSize); i < s; ++i, ++it) {
				m_serializer.serialize(out, store.at(*it), sf);
			}
		}
		else {
			m_serializer.serialize(out, store.id2ItemIterator(itemIds.begin()), store.id2ItemIterator(itemIds.end()), sf);
		}
	}
	m_serializer.footer(out, sf);
	m_serializer.streamUnprepare(out, streamcfg);
	
	ttm.end();
	log(irId, "all", ttm, cqr);
}

void CQRItems::info() {
	auto irId = genIntReqId("info");
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	auto parsingCorrect = false;
	auto ids = parseJsonArray<uint32_t>(request().get("i"), parsingCorrect);
	std::ostream & out = response().out();
	const auto & store = d().completer->store();
	out << "[";
	auto separator = "";
	for(auto id : ids) {
		out << separator;
		const auto& firstPoint = store.geoShape(id).first();
		std::stringstream firstPointSream;
		firstPointSream << "\"firstPoint\": { \"lat\": " << firstPoint.lat() << ", \"lon\": " << firstPoint.lon() << "}";
		m_serializer.serialize(out, store.at(id), (ItemSerializer::SerializationFormat)(0x6),firstPointSream.str());
		separator = ",";
	}
	out << "]";
	ttm.end();
	log(irId, "info", ttm);
}

}//end namespace oscar_web
