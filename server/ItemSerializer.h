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
	typedef enum { SF_NONE=0x0, SF_OSCAR=0x1, SF_GEO_JSON=0x2, SF_WITH_SHAPE=0x4} SerializationFormat;
public:
	ItemSerializer();
	~ItemSerializer();
public:
	int streamPrepare(std::ostream & out) const;
	void streamUnprepare(std::ostream & out, int streamcfg) const;
public:
	///Header for writing multiple items
	void header(std::ostream & out, SerializationFormat sf);
	///Footer for writing multiple items
	void footer(std::ostream & out, SerializationFormat sf);
public:
	void serialize(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, SerializationFormat sf) const;
	void serialize(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, SerializationFormat sf, const std::string & addData) const;
	void serialize(std::ostream & out, const sserialize::Static::spatial::GeoShape & gs, SerializationFormat sf) const;
	
	template<typename T_ITERATOR>
	void serialize(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, SerializationFormat sf) const;
	template<typename T_ITERATOR>
	void serialize(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, SerializationFormat sf, const std::string & addData) const;
	template<typename T_ITERATOR>
	void serialize(std::ostream & out, T_ITERATOR begin, uint32_t count, SerializationFormat sf) const; 
private:
	void toJson(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape, const std::string & addData) const;
	void toJson(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape) const;
	void toJson(std::ostream & out, const sserialize::Static::spatial::GeoShape & gs) const;

	void toJson(std::ostream & out, sserialize::Static::spatial::GeoPolygon::const_iterator it, sserialize::Static::spatial::GeoPolygon::const_iterator end) const;
	void toJson(std::ostream & out, const sserialize::Static::spatial::GeoMultiPolygon::PolygonList & polys) const;

	template<typename T_ITERATOR>
	void toJson(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, bool withShape) const;
	template<typename T_ITERATOR>
	void toJson(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, bool withShape, const std::string & addData) const;
	template<typename T_ITERATOR>
	void toJson(std::ostream& out, T_ITERATOR begin, uint32_t count, bool withShape) const; 
private:
	void toGeoJson(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape, const std::string & addData) const;
	void toGeoJson(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape) const;
	void toGeoJson(std::ostream & out, const sserialize::Static::spatial::GeoShape & gs) const;
	
	void toGeoJson(std::ostream& out, sserialize::Static::spatial::DenseGeoPointVector::const_iterator it, const sserialize::Static::spatial::DenseGeoPointVector::const_iterator& end) const;
	void toGeoJson(std::ostream & out, sserialize::Static::spatial::GeoMultiPolygon::PolygonList::const_iterator begin, const sserialize::Static::spatial::GeoMultiPolygon::PolygonList::const_iterator & end) const;

	template<typename T_ITERATOR>
	void toGeoJson(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, bool withShape) const;
	template<typename T_ITERATOR>
	void toGeoJson(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, bool withShape, const std::string & addData) const;
	template<typename T_ITERATOR>
	void toGeoJson(std::ostream & out, T_ITERATOR begin, uint32_t count, bool withShape) const; 
private:
	void toJsonObjectMembers(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape) const;
	void toGeoJsonObjectMembers(std::ostream & out, const liboscar::Static::OsmKeyValueObjectStore::Item & item, bool withShape) const;
private:
	sserialize::JsonEscaper m_escaper;
	int m_precision;
};

template<typename T_ITERATOR>
void ItemSerializer::serialize(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, SerializationFormat sf) const {
	if (sf & SF_GEO_JSON) {
		toGeoJson(out, begin, end, sf & SF_WITH_SHAPE);
	}
	else {
		toJson(out, begin, end, sf & SF_WITH_SHAPE);
	}
}

template<typename T_ITERATOR>
void ItemSerializer::serialize(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, SerializationFormat sf, const std::string & addData) const {
	if (sf & SF_GEO_JSON) {
		toGeoJson(out, begin, end, sf & SF_WITH_SHAPE, addData);
	}
	else {
		toJson(out, begin, end, sf & SF_WITH_SHAPE, addData);
	}
}

template<typename T_ITERATOR>
void ItemSerializer::serialize(std::ostream & out, T_ITERATOR begin, uint32_t count, SerializationFormat sf) const {
	if (sf & SF_GEO_JSON) {
		toGeoJson(out, begin, count, sf & SF_WITH_SHAPE);
	}
	else {
		toJson(out, begin, count, sf & SF_WITH_SHAPE);
	}
}

//oscar json format


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

template<typename T_ITERATOR>
void ItemSerializer::toGeoJson(std::ostream& out, T_ITERATOR begin, const T_ITERATOR& end, bool withShape) const {
	if (begin == end) {
		return;
	}
	toGeoJson(out, *begin, withShape);
	for(++begin; begin != end; ++begin) {
		out << ",";
		toGeoJson(out, *begin, withShape);
	}
}

template<typename T_ITERATOR>
void ItemSerializer::toGeoJson(std::ostream & out, T_ITERATOR begin, const T_ITERATOR & end, bool withShape, const std::string & addData) const {
	if (begin == end) {
		return;
	}
	toGeoJson(out, *begin, withShape, addData);
	for(++begin; begin != end; ++begin) {
		out << ",";
		toGeoJson(out, *begin, withShape, addData);
	}
}

template<typename T_ITERATOR>
void ItemSerializer::toGeoJson(std::ostream& out, T_ITERATOR begin, uint32_t count, bool withShape) const {
	if (!count) {
		return;
	}
	toGeoJson(out, *begin, withShape);
	for(++begin, --count; count; ++begin, --count) {
		out << ",";
		toGeoJson(out, *begin, withShape);
	}
}

} //end namespace ItemSerializer

#endif