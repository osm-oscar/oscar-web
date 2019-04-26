#ifndef OSCAR_WEB_KV_CLUSTERING_H
#define OSCAR_WEB_KV_CLUSTERING_H

#include <cppcms/application.h>
#include "types.h"

namespace oscar_web {

/**
  * Computes and returns a regional, a key value or a key clustering
  * based on the count of the items which are in the region or have the key-value-pairs or keys
  * and based on the intersections between the items
  */

class KVClustering : public cppcms::application {
public:
	KVClustering(cppcms::service &srv, const CompletionFileDataPtr &dataPtr);

	~KVClustering() override;

	void get();

private:
	typedef sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr SubSetNodePtr;
private:
	CompletionFileDataPtr m_dataPtr;
	liboscar::Static::OsmKeyValueObjectStore m_store;
	std::stringstream m_outStr;
	std::uint8_t m_mode;
	std::uint32_t m_numberOfRefinements;
	std::stringstream m_debugStr;
	std::uint32_t defaultFacetSize;
	std::map<std::uint32_t, std::uint32_t> dynFacetSize;
	long m_itemCount;
private:

	/**
	 * Calculates the Parents with the highest item count and no intersections
	 * @tparam mapKey either uint32_t or std::pair<uint32_t, uint32_t>
	 * @param parentItemMap parent -> items
	 * @param parentItemVec parent -> itemCount sorted by itemCount descending
	 * @param subSet the subset used by regional clustering
	 */
	template<typename mapKey>
	void writeParentsWithNoIntersection(const std::unordered_map<mapKey, std::vector<std::uint32_t >> &parentItemMap,
										const std::vector<std::pair<mapKey, std::uint32_t >> &parentItemVec,
										sserialize::Static::spatial::detail::SubSet subSet);

	void writeLogStats(const std::string &fn, const std::string &query, const sserialize::TimeMeasurer &tm,
					   uint32_t cqrSize);

	/**
	 * Iterates through the resultset and put the parents and items into the map
	 * @tparam mapKey either uint32_t or std::pair<uint32_t, uint32_t>
	 * @param keyItemMap the map to be filled
	 * @param cqr the resultSet
	 * @param exceptions a set of exceptions which will not be added to the map
	 * @param keyExceptionRanges prefix exception ranges which will not be added to the map
	 */
	template<typename mapKey>
	void generateKeyItemMap(std::unordered_map<mapKey, std::vector<uint32_t>> &keyItemMap,
							const sserialize::CellQueryResult &cqr,
							const std::set<mapKey> &exceptions,
							const std::vector<std::pair<sserialize::SizeType, sserialize::SizeType>> &keyExceptionRanges);

	/**
	 * Computes whether a sorted collection intersects another
	 * collection given the min number of intersections
	 * @tparam It the iterator of the collection
	 * @param beginI the beginning of the first iterator
	 * @param endI the end of the firs iterator
	 * @param beginJ the beginning of the second iterator
	 * @param endJ the end of the second iterator
	 * @param minNumber the min number of intersections
	 * @return true, iff the first collection intersects the second collection more times than minNumber
	 */
	template<typename It>
	bool
	hasIntersection(It beginI, It endI, It beginJ, It endJ, const std::float_t &minNumber);

	/**
	 * prints the result
	 * @param id id of the parent
	 * @param itemCount count of the corresponding items
	 */
	void printResult(const std::uint32_t &id, const long &itemCount);

	/**
	 * prints the result
	 * @param id id of the key value pair
	 * @param itemCount count of the corresponding items
	 */
	void printResult(const std::pair<std::uint32_t, std::uint32_t> &id, const long &itemCount);

	/**
	 * Puts the map into the vector and sorts it by value
	 * @tparam mapKey either uint32_t or std::pair<uint32_t, uint32_t>
	 * @param parentItemMap the map to be sorted
	 * @param parentItemVec the resulting vector
	 */
	template<typename mapKey>
	void sortMap(std::unordered_map<mapKey, std::vector<uint32_t>> &parentItemMap, std::vector<std::pair<mapKey, std::uint32_t>> &parentItemVec);

	/**
	 * inserts a key into the map
	 * @param keyItemMap the map to be modified
	 * @param item a result item
	 * @param i the position of the key in the item
	 * @param exceptions
	 * @param keyExceptionRanges
	 * @param itemId
	 */
	void insertKey(std::unordered_map<std::uint32_t, std::vector<uint32_t>> &keyItemMap,
				   const liboscar::Static::OsmKeyValueObjectStore::KVItemBase &item,
				   const uint32_t &i,
				   const std::set<uint32_t> &exceptions,
				   const std::vector<std::pair<sserialize::SizeType, sserialize::SizeType>> &keyExceptionRanges,
				   const std::uint32_t &itemId);

	/**
	 * inserts a key value pair into the map
	 * @param keyValueItemMap the map to be modified
	 * @param item a result item
	 * @param i the position of the key in the item
	 * @param exceptions
	 * @param keyExceptionRanges
	 * @param itemId
	 */
	void
	insertKey(std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::vector<uint32_t>> &keyValueItemMap,
			  const liboscar::Static::OsmKeyValueObjectStore::KVItemBase &item,
			  const uint32_t &i,
			  const std::set<std::pair<uint32_t, uint32_t >> &exceptions,
			  const std::vector<std::pair<sserialize::SizeType, sserialize::SizeType>> &keyExceptionRanges,
			  const std::uint32_t &itemId);

	/**
	 * decides whether a key is in the exception ranges
	 * @param key
	 * @param keyExceptionRanges
	 * @return true, iff key is in exception ranges
	 */
	bool isException(const std::uint32_t &key,
					 const std::vector<std::pair<sserialize::SizeType, sserialize::SizeType>> &keyExceptionRanges);

	/**
	 * returns the item set of a key value pair
	 * @param id
	 * @param map
	 * @param subSet just needed for regional clustering
	 * @return
	 */
	std::vector<uint32_t> getSet(const std::pair<std::uint32_t, std::uint32_t> &id,
								 const std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::vector<uint32_t >> &map,
								 const sserialize::Static::spatial::detail::SubSet &subSet);

	/**
	 *
	 * @param id
	 * @param map
	 * @param subSet
	 * @return
	 */
	std::vector<uint32_t>
	getSet(const uint32_t &id, const std::unordered_map<uint32_t, std::vector<uint32_t >> &map,
		   const sserialize::Static::spatial::detail::SubSet &subSet);

	template<typename iterable>
	void printFacet(uint32_t keyId, iterable values);
};


}//end namespace

#endif
