#ifndef OSCAR_WEB_ITEM_SERIALIZER_H
#define OSCAR_WEB_ITEM_SERIALIZER_H
#include <liboscar/OsmKeyValueObjectStore.h>
#include <sserialize/Static/GeoWay.h>
#include <sserialize/Static/GeoPolygon.h>
#include <sserialize/Static/GeoMultiPolygon.h>
#include <sserialize/strings/stringfunctions.h>

namespace oscar_web {

class ItemSerializer final {
public:
	ItemSerializer();
	~ItemSerializer();
public:
	void toJson(std::ostream & out, sserialize::Static::spatial::GeoPolygon::const_iterator it, sserialize::Static::spatial::GeoPolygon::const_iterator end);
	void toJson(std::ostream & out, const sserialize::Static::spatial::GeoMultiPolygon::PolygonList & polys);
	void toJson(std::ostream & out, const sserialize::Static::spatial::GeoShape & gs);
	void toJson(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape);
private:
	sserialize::JsonEscaper m_escaper;
};

} //end namespace ItemSerializer

#endif