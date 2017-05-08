#include "ItemSerializer.h"

namespace oscar_web {

ItemSerializer::ItemSerializer() : m_precision(8) {}

ItemSerializer::~ItemSerializer() {}

int ItemSerializer::streamPrepare(std::ostream& out) const {
	int prec = out.precision();
	out.precision(m_precision);
	return prec;
}

void ItemSerializer::streamUnprepare(std::ostream& out, int streamcfg) const {
	out.precision(streamcfg);
}

void ItemSerializer::header(std::ostream & out, SerializationFormat sf) {
	if (sf & SF_GEO_JSON) {
		out << "{\"type\":\"FeatureCollection\",\"features\":[";
	}
	else {
		out << "[";
	}
}

void ItemSerializer::footer(std::ostream & out, SerializationFormat sf) {
	if (sf & SF_GEO_JSON) {
		out << "]}";
	}
	else {
		out << "]";
	}
}

void ItemSerializer::serialize(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, SerializationFormat sf) const {
	if (sf & SF_GEO_JSON) {
		toGeoJson(out, item, sf & SF_WITH_SHAPE);
	}
	else {
		toJson(out, item, sf & SF_WITH_SHAPE);
	}
}

void ItemSerializer::serialize(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, SerializationFormat sf, const std::string & addData) const {
	if (sf & SF_GEO_JSON) {
		toGeoJson(out, item, sf & SF_WITH_SHAPE, addData);
	}
	else {
		toJson(out, item, sf & SF_WITH_SHAPE, addData);
	}
}

void ItemSerializer::serialize(std::ostream & out, const sserialize::Static::spatial::GeoShape & gs, SerializationFormat sf) const {
	if (sf & SF_GEO_JSON) {
		toGeoJson(out, gs);
	}
	else {
		toJson(out, gs);
	}
}

//oscar json formats

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

//GeoJson stuff
void
ItemSerializer::toGeoJson(std::ostream& out,
						sserialize::Static::spatial::DenseGeoPointVector::const_iterator it,
						const sserialize::Static::spatial::DenseGeoPointVector::const_iterator & end) const
{
	sserialize::Static::spatial::GeoPoint gp(*it);
	out << "[" << gp.lon() << "," << gp.lat() << "]";
	for(++it; it != end; ++it) {
		gp = *it;
		out << ",[" << gp.lon() << "," << gp.lat() << "]";
	}
}

void
ItemSerializer::toGeoJson(std::ostream& out, sserialize::Static::spatial::GeoMultiPolygon::PolygonList::const_iterator begin, const sserialize::Static::spatial::GeoMultiPolygon::PolygonList::const_iterator & end) const
{
	if (begin != end) {
		out << "[[";
		auto poly = *begin;
		toGeoJson(out, poly.cbegin(), poly.cend());
		out << "]]";
		++begin;
		for(; begin != end; ++begin) {
			out << ",[[";
			poly = *begin;
			toGeoJson(out, poly.cbegin(), poly.cend());
			out << "]]";
		}
	}
}

void
ItemSerializer::toGeoJson(std::ostream& out, const sserialize::Static::spatial::GeoShape& gs) const
{
	sserialize::spatial::GeoShapeType gst = gs.type();
	out << "{\"type\":\"";
	switch(gst) {
	case sserialize::spatial::GS_POINT:
		out << "Point";
		break;
	case sserialize::spatial::GS_WAY:
		out << "LineString";
		break;
	case sserialize::spatial::GS_POLYGON:
		out << "Polygon";
		break;
	case sserialize::spatial::GS_MULTI_POLYGON:
		out << "MultiPolygon";
		break;
	default:
		break;
	}
	
	out << "\",\"coordinates\":";
	
	switch(gst) {
	case sserialize::spatial::GS_POINT:
	{
		const sserialize::Static::spatial::GeoPoint * gp = gs.get<sserialize::Static::spatial::GeoPoint>();
		out << "[" << gp->lon() << "," << gp->lat() << "]";
		break;
	}
	case sserialize::spatial::GS_WAY:
	{
		const sserialize::Static::spatial::GeoWay * gw = gs.get<sserialize::Static::spatial::GeoWay>();
		out << "[";
		toGeoJson(out, gw->cbegin(), gw->cend());
		out << "]";
		break;
	}
	case sserialize::spatial::GS_POLYGON:
	{
		const sserialize::Static::spatial::GeoWay * gw = gs.get<sserialize::Static::spatial::GeoWay>();
		out << "[[";
		toGeoJson(out, gw->cbegin(), gw->cend());
		out << "]]";
		break;
	}
	case sserialize::spatial::GS_MULTI_POLYGON:
	{
		const sserialize::Static::spatial::GeoMultiPolygon * gmw = gs.get<sserialize::Static::spatial::GeoMultiPolygon>();
		out << "[";
		toGeoJson(out, gmw->outerPolygons().cbegin(), gmw->outerPolygons().cend());
		if (gmw->innerPolygons().size()) {
			out << ",";
			toGeoJson(out, gmw->innerPolygons().cbegin(), gmw->innerPolygons().cend());
		}
		out << "]";
		break;
	}
	default:
		break;
	}
	out << '}';
}

void
ItemSerializer::toGeoJson(std::ostream& out, const liboscar::Static::OsmKeyValueObjectStore::Item& item, bool withShape) const
{
	out << '{';
	toGeoJsonObjectMembers(out, item, withShape);
	out << '}';
}

void
ItemSerializer::toGeoJson(std::ostream& out, const liboscar::Static::OsmKeyValueObjectStore::Item& item, bool withShape, const std::string & addData) const
{
	out << '{';
	toGeoJsonObjectMembers(out, item, withShape);
	if (addData.size()) {
		out << ',';
		out << addData;
	}
	out << '}';
}

void
ItemSerializer::toGeoJsonObjectMembers(std::ostream& out, const liboscar::Static::OsmKeyValueObjectStore::Item& item, bool withShape) const
{
	liboscar::Static::OsmKeyValueObjectStorePayload payload(item.payload());
	sserialize::Static::spatial::GeoShape shape(payload.shape());
	
	out << "\"type\":\"Feature\",";
	out << "\"geometry\":";
	if (withShape) {
		toGeoJson(out, shape);
	}
	else {
		out << "null";
	}
	out << ",";
	out << "\"properties\":{";
	
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
	out << "\"score\":" << payload.score();
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
	out << '}'; //end of properties
}

}//end namespace