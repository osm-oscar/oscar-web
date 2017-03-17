#ifndef OSCAR_WEB_CQR_ITEMS_H
#define OSCAR_WEB_CQR_ITEMS_H
#include <cppcms/application.h>

#include "types.h"
#include "ItemSerializer.h"

namespace oscar_web {

/**
  *This is the main query completer.
  */

class CQRItems: public cppcms::application {
public:
	CQRItems(cppcms::service& srv, const CompletionFileDataPtr & dataPtr);
	virtual ~CQRItems();
	/** returns the top-k items for the query q:
	  * q=<string searchstring>
	  * k=<uint32_t number of items>
	  * o=<uint32_t in items result list>
	  * s=<bool with shapes>
	  * Return:
	  * [Json item description]
	  */
	void some();
	/** returns all items of a query
	  * q=<string searchstring>
	  * s=<bool with shapes>
	  * p=<bool with parents>
	  * Return:
	  * [Json item description]
	  */
	void all();
private:
	typedef sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr SubSetNodePtr;
private:
	CompletionFileDataPtr m_dataPtr;
	liboscar::Static::OsmKeyValueObjectStore m_store;
	ItemSerializer m_serializer;
private:
	void writeLogStats(const std::string & fn, const std::string& query, const sserialize::TimeMeasurer& tm, uint32_t cqrSize, uint32_t idxSize);
	template<typename T_IT>
	void writeMultiple(std::ostream & out, T_IT begin, T_IT end, bool withShape);
};



}//end namespace

#endif