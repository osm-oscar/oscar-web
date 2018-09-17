#ifndef OSCAR_WEB_KV_CLUSTERING_H
#define OSCAR_WEB_KV_CLUSTERING_H

#include <cppcms/application.h>
#include "types.h"

namespace oscar_web {

/**
  *This is the main query completer.
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
    private:

        template<typename mapKey>
        void writeParentsWithNoIntersection(std::ostream &out,
                                            const std::unordered_map<mapKey, std::set<std::uint32_t >> &parentItemMap,
                                            const std::vector<std::pair<mapKey, std::uint32_t >> &parentItemVec,
                                            const std::uint8_t &mode,
                                            const liboscar::Static::OsmKeyValueObjectStore &store,
                                            const uint32_t &numberOfRefinements,
                                            std::stringstream &debugStr);

        void writeLogStats(const std::string &fn, const std::string &query, const sserialize::TimeMeasurer &tm,
                           uint32_t cqrSize, uint32_t idxSize);

        template<typename mapKey>
        void generateKeyItemMap(std::unordered_map<mapKey, std::set<uint32_t>> &keyItemMap,
                                const sserialize::CellQueryResult &cqr,
                                std::stringstream &debug, const std::vector<mapKey>& exceptions);

        bool
        hasIntersection(const std::set<uint32_t> &set1, const std::set<uint32_t> &set2, const std::float_t &minNumber);

        void printResult(const std::uint32_t &id, const long &itemCount, std::ostream &out,const std::uint8_t & mode,
                         const liboscar::Static::OsmKeyValueObjectStore &store);

        void printResult(const std::pair<std::uint32_t, std::uint32_t> &id, const long &itemCount, std::ostream &out,
                         const std::uint8_t &mode, const liboscar::Static::OsmKeyValueObjectStore &store);

        template<typename mapKey>
        void sortMap(std::unordered_map<mapKey, std::set<uint32_t>>& parentItemMap,
                std::vector<std::pair<mapKey, std::uint32_t>>& parentItemVec, std::stringstream& debug);

        void insertKey(std::unordered_map<std::uint32_t, std::set<uint32_t>> &keyItemMap, const liboscar::Static::OsmKeyValueObjectStoreItem& item, const uint32_t& i,
                       const std::vector<uint32_t>& exceptions);

        void insertKey(std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::set<uint32_t>>& keyValueItemMap, const liboscar::Static::OsmKeyValueObjectStoreItem& item, const uint32_t& i, const std::vector<std::pair<uint32_t , uint32_t >>& exceptions);


    };


}//end namespace

#endif
