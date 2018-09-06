#ifndef OSCAR_WEB_KV_CLUSTERING_H
#define OSCAR_WEB_KV_CLUSTERING_H
#include <cppcms/application.h>
#include "types.h"

namespace oscar_web {

/**
  *This is the main query completer.
  */

class KVClustering: public cppcms::application {
public:
	KVClustering(cppcms::service& srv, const CompletionFileDataPtr & dataPtr);
	virtual ~KVClustering();
	void get();
private:
	typedef sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr SubSetNodePtr;
private:
	CompletionFileDataPtr m_dataPtr;
	liboscar::Static::OsmKeyValueObjectStore m_store;
private:
	void writeLogStats(const std::string & fn, const std::string& query, const sserialize::TimeMeasurer& tm, uint32_t cqrSize, uint32_t idxSize);
	void generateKvOutput(std::ostream & out,
	                    std::unordered_map<std::uint32_t, std::vector<uint32_t>> keyValueMap,
						std::unordered_map<std::uint32_t, std::uint32_t> keyCountMap,
						std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t> keyValueCountMap,
						uint32_t itemCount);
	void kvClustering(std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t>& keyValueCountMap,
                      std::unordered_map<std::uint32_t, std::vector<uint32_t>>& keyValueMap,
                      std::unordered_map<std::uint32_t, std::uint32_t>& keyCountMap,
                      const sserialize::CellQueryResult& cqr);
	bool hasIntersection(const std::set<uint32_t>& set1, const std::set<uint32_t>& set2);
    void getParentsWithNoIntersection(const std::vector<std::pair<std::uint32_t, std::set<uint32_t>>> &parentKeyVec,
                                      std::ostream &out);
    void printParent(const uint32_t& parentId, const long& itemCount, std::ostream &out);
};



}//end namespace

#endif
