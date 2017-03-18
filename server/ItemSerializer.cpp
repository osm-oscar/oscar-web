#include "ItemSerializer.h"

namespace oscar_web {

ItemSerializer::ItemSerializer() {}

ItemSerializer::~ItemSerializer() {}

void
ItemSerializer::toJson(std::ostream& out,
						sserialize::Static::spatial::DenseGeoPointVector::const_iterator it,
						sserialize::Static::spatial::DenseGeoPointVector::const_iterator end) const
{
	sserialize::Static::spatial::GeoPoint gp(*it);
	out << "[" << gp.lat() << "," << gp.lon() << "]";
	for(++it; it != end; ++it) {
		gp = *it;
		out << ",[" << gp.lat() << "," << gp.lon() << "]";
	}
}

void
ItemSerializer::toJson(std::ostream& out, const sserialize::Static::Array< sserialize::Static::spatial::GeoPolygon >& polys) const
{
	out << "[";
	if (polys.size()) {
		sserialize::Static::spatial::GeoMultiPolygon::PolygonList::const_iterator pIt(polys.cbegin()), pEnd(polys.cend());
		sserialize::Static::spatial::GeoMultiPolygon::PolygonList::const_reference gp(*pIt);
		out << "[";
		toJson(out, gp.cbegin(), gp.cend());
		out << "]";
		for(++pIt; pIt != pEnd; ++pIt) {
			out << ",[";
			gp = *pIt;
			toJson(out, gp.cbegin(), gp.cend());
			out << "]";
		}
	}
	out << "]";
}

void
ItemSerializer::toJson(std::ostream& out, const sserialize::Static::spatial::GeoShape& gs) const
{
	sserialize::spatial::GeoShapeType gst = gs.type();
	out << "{\"t\":" << gst << ",\"v\":";
	switch(gst) {
	case sserialize::spatial::GS_POINT:
		{
			const sserialize::Static::spatial::GeoPoint * gp = gs.get<sserialize::Static::spatial::GeoPoint>();
			out << "[" << gp->lat() << "," << gp->lon() << "]";
		}
		break;
	case sserialize::spatial::GS_WAY:
	case sserialize::spatial::GS_POLYGON:
		{
			const sserialize::Static::spatial::GeoWay * gw = gs.get<sserialize::Static::spatial::GeoWay>();
			out << "[";
			if (gw->size()) {
				sserialize::Static::spatial::GeoWay::const_iterator it(gw->cbegin()), end(gw->cend());
				sserialize::Static::spatial::GeoPoint gp(*it);
				out << "[" << gp.lat() << "," << gp.lon() << "]";
				for(++it; it != end; ++it) {
					gp = *it;
					out << ",[" << gp.lat() << "," << gp.lon() << "]";
				}
			}
			out << "]";
		}
		break;
	case sserialize::spatial::GS_MULTI_POLYGON:
		{
			out << "{";
			const sserialize::Static::spatial::GeoMultiPolygon * gmw = gs.get<sserialize::Static::spatial::GeoMultiPolygon>();
			if (gmw->innerPolygons().size()) {
				out << "\"inner\":";
				toJson(out, gmw->innerPolygons());
				out << ",";
			}
			out << "\"outer\":";
			toJson(out, gmw->outerPolygons());
			out << "}";
		}
		break;
	default:
		break;
	}
	out << "}";
}

void
ItemSerializer::toJson(std::ostream& out, const liboscar::Static::OsmKeyValueObjectStore::Item& item, bool withShape) const
{
	out << '{';
	toJsonObjectMembers(out, item, withShape);
	out << '}';
}

void
ItemSerializer::toJson(std::ostream& out, const liboscar::Static::OsmKeyValueObjectStore::Item& item, bool withShape, const std::string & addData) const
{
	out << '{';
	toJsonObjectMembers(out, item, withShape);
	if (addData.size()) {
		out << ',';
		out << addData;
	}
	out << '}';
}

void
ItemSerializer::toJsonObjectMembers(std::ostream& out, const liboscar::Static::OsmKeyValueObjectStore::Item& item, bool withShape) const
{
	liboscar::Static::OsmKeyValueObjectStorePayload payload(item.payload());
	sserialize::Static::spatial::GeoShape shape(payload.shape());
	out << "\"id\":" << item.id() << ",";
	out << "\"osmid\":" << item.osmId() << ",";
	out << "\"type\":\"";
	switch (payload.type()) {

	case liboscar::OSMIT_NODE:
		out << "node";
		break;
	case liboscar::OSMIT_WAY:
		out << "way";
		break;
	case liboscar::OSMIT_RELATION:
		out << "relation";
		break;
	case liboscar::OSMIT_INVALID:
	default:
		out << "invalid";
		break;
	};
	out << "\",";
	out << "\"score\":" << payload.score() << ",";
	sserialize::spatial::GeoRect bbox(shape.boundary());
	out << "\"bbox\":[" << bbox.minLat() << "," << bbox.maxLat() << "," << bbox.minLon() << "," << bbox.maxLon() << "],";
	out << "\"shape\":";
	if (withShape && shape.size()) {
		toJson(out, shape);
	}
	else {
		out << "{\"t\":-1}";
	}
	if (item.size()) {
		out << ",\"k\":[\"" << m_escaper.escape(item.key(0)) << "\"";
		for(uint32_t i=1, s=item.size(); i < s; ++i) {
			out << ",\"" << m_escaper.escape(item.key(i)) << "\"";
		}
		out << "],\"v\":[\"" <<  m_escaper.escape(item.value(0)) << "\"";
		for(uint32_t i=1, s=item.size(); i < s; ++i) {
			out << ",\"" <<  m_escaper.escape(item.value(i)) << "\"";
		}
		out << "]";
	}
}

}//end namespace