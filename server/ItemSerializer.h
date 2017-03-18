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
	void toJson(std::ostream & out, sserialize::Static::spatial::GeoPolygon::const_iterator it, sserialize::Static::spatial::GeoPolygon::const_iterator end) const;
	void toJson(std::ostream & out, const sserialize::Static::spatial::GeoMultiPolygon::PolygonList & polys) const;
	void toJson(std::ostream & out, const sserialize::Static::spatial::GeoShape & gs) const;
	void toJson(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape) const;
	void toJson(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape, const std::string & addData) const;
	template<typename T_ITERATOR>
	void toJson(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, bool withShape) const;
	template<typename T_ITERATOR>
	void toJson(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, bool withShape, const std::string & addData) const;
	template<typename T_ITERATOR>
	void toJson(std::ostream & out,T_ITERATOR begin, uint32_t count, bool withShape) const; 
private:
	void toJsonObjectMembers(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape) const;
private:
	sserialize::JsonEscaper m_escaper;
};

template<typename T_ITERATOR>
void ItemSerializer::toJson(std::ostream& out, T_ITERATOR begin, const T_ITERATOR& end, bool withShape) const {
	if (begin == end) {
		return;
	}
	toJson(out, *begin, withShape);
	for(++begin; begin != end; ++begin) {
		out << ",";
		toJson(out, *begin, withShape);
	}
}

template<typename T_ITERATOR>
void ItemSerializer::toJson(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, bool withShape, const std::string & addData) const {
	if (begin == end) {
		return;
	}
	toJson(out, *begin, withShape, addData);
	for(++begin; begin != end; ++begin) {
		out << ",";
		toJson(out, *begin, withShape, addData);
	}
}

template<typename T_ITERATOR>
void ItemSerializer::toJson(std::ostream& out, T_ITERATOR begin, uint32_t count, bool withShape) const {
	if (!count) {
		return;
	}
	toJson(out, *begin, withShape);
	for(++begin, --count; count; ++begin, --count) {
		out << ",";
		toJson(out, *begin, withShape);
	}
}

} //end namespace ItemSerializer

#endif