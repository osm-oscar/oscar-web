#ifndef OSCAR_WEB_CQR_COMPLETER_H
#define OSCAR_WEB_CQR_COMPLETER_H
#include <unordered_map>
#include <sserialize/utility/debug.h>
#include "BaseApp.h"
#include "types.h"
#include "GeoHierarchySubSetSerializer.h"
#include "CellQueryResultsSerializer.h"

namespace sserialize {
class TimeMeasurer;
}

namespace oscar_web {

/**
  *This is the main query completer.
  */

class CQRCompleter: public BaseApp {
public:
	CQRCompleter(cppcms::service& srv, const CompletionFileDataPtr & dataPtr);
	virtual ~CQRCompleter();
	/**
	  * q=<searchstring>
	  * sst=(flatxml|treexml|flatjson)
	  * Return:
	  * CellQueryResultsSerializer.write|SubSet as xml/json/binary
	  */
	void fullCQR();
	/** Returns a binary array of uint32_t with the ids of k items skipping o of the selected regions and the direct children of the region
	  * if openhints are requests then two additional arrays are present containing the path of the openhint and all seen regions on the path
	  * query:
	  * q=<searchstring>
	  * oh=<float between 0..1.0 defining the termination fraction when the opening-path stops>
	  * oht=(global|relative) theshold type: global compares with the global item count, relative with the parent item count
	  * Return:
	  * array<uint32_t>(regionids): region ids of the opening-path calculated if oh option was given
	  * array<uint32_t|array<(uint32_t|uint32_t)> region child info [regionid, [(region children|region children maxitems)] encoded in a single array<uint32_t>
	  */
	void simpleCQR();
	/** returns the top-k items for the query q:
	  * q=<searchstring>
	  * k=<number_of_items>
	  * o=<offset_in_items_result_list>
	  * Return:
	  * array<uint32_t> : [item id]
	  */
	void items();

	/** returns items and their location for the query q:
	  * q=<searchstring>
	  * Return:
	  * array<uint32_t> : [item id, maxLon*10^7, maxLat*10^7]
	  */
	void itemsWithLocation();
	
	/** returns approximate query result stats
	 * q=<searchstring>
	 * rf=<region filter>
	 */
	void apxStats();
	

	/** return the region children for the query q:
	  * q=<searchstring>
	  * r=<regionid>
	  * rf=<region filter>
	  * Return:
	  * array<(uint32_t, uint32_t)>: [(region children|region children maxitems)]
	  */
	void children();
	
	/** return the region children for the query q:
	  * call with POST
	  * q=<searchstring>
	  * rf=<region filter>
	  * which=[<regionId>]
	  * withChildrenCells=true|FALSE
	  * withParentCells=true|FALSE
	  * regionExclusiveCells=true|FALSE
	  * Return:
	  * { graph: { regionId: [childId]}, cells: { regionId: [cellId] }, regionInfo: { regionId: { apxitems: <int>, clusterHint, leaf: <bool>}} }
	  */
	void childrenInfo();
	
	/** return the cell information for the query q for the specified regions:
	  * call with POST
	  * q=<searchstring>
	  * rf=<region filter>
	  * which=[<regionId>]
	  * regionExclusiveCells=true|FALSE
	  * Return:
	  * { regionId: [cellId] }
	  */
	void cellInfo();
	
	/** Return data about the cells (currently the number of items in the cell)
	  * call with post
	  * q=<searchstring>
	  * rf=<region filter>
	  * Return:
	  * { cellId: <int: size> }
	  */
	void cellData();
	
	/** return the cells for the query q:
	  * q=<searchstring>
	  * Return:
	  * [cellId]
	  */
	void cells();
	/** returns the top-k items of each cell for the query q:
	  * call with POST
	  * q=<searchstring>
	  * k=<number_of_items>
	  * o=<offset_in_items_result_list>
	  * which=[cellId] cellIds in ascending order
	  * Return:
	  * {<cellId> : [<itemId>]}
	  */
	void cellItems();
	
	/** return the maximum set of independet region children for the query q:
	  * q=<searchstring>
	  * rf=<region filter>
	  * r=<regionid>
	  * o=<maximum overlapp in percent>
	  * Return:
	  * array<uint32_t>: [regionId]
	  */
	void maximumIndependentChildren();
	
	/** returns the dag for the query
	  *
	  * sst=(flatjson)
	  * rf=<region filter>
	  * q=<searchstring>
	  * returns GeoHierarchySubSetSerializer dag-only
	  */
	void dag();
	
	/** Call with post!
	  * returns cluster center hints for the given regions
	  * rf=<region filter>
	  * q=<searchstring>
	  * which=[regionId]
	  * returns { regionId : [lat, lon] }
	  */
	  void clusterHints();
private:
	typedef sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr SubSetNodePtr;
private:
	void writeSubSet(std::ostream & out, const std::string & sst, const sserialize::Static::spatial::GeoHierarchy::SubSet & subSet);
	void writeDag(std::ostream & out, const std::string & sst, const sserialize::Static::spatial::GeoHierarchy::SubSet & subSet);
	///calulates cluster centers for the hierarchy, ids are ghIds!
	std::unordered_map<uint32_t, std::pair<double, double> > getClusterCenters(sserialize::Static::spatial::GeoHierarchy::SubSet & subSet);
private:
	GeoHierarchySubSetSerializer m_subSetSerializer;
	CellQueryResultsSerializer m_cqrSerializer;
};

}//end namespace

#endif
