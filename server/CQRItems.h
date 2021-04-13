#ifndef OSCAR_WEB_CQR_ITEMS_H
#define OSCAR_WEB_CQR_ITEMS_H

#include "BaseApp.h"
#include "types.h"
#include "ItemSerializer.h"

namespace oscar_web {

/**
  *This is the main query completer.
  */

class CQRItems: public BaseApp {
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
	  * i=<bool with items = true>
	  * p=<bool with parents>
	  * s=<bool with shapes>
	  * Return:
	  * [Json item description]
	  */
	void all();

	/** returns itemInfo corresponding to an itemId-array
	  * i=<[itemId]>
	  * Return:
	  * [Json item description]
	  */
	void info();
	/** returns a region if the query is very similar to the region
	 *  q=<searchstring>
	 *  Return:
	 *  [region as geojson]
	 */
    void isRegion();

private:
	typedef sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr SubSetNodePtr;
private:
	liboscar::Static::OsmKeyValueObjectStore m_store;
	ItemSerializer m_serializer;
};



}//end namespace

#endif
