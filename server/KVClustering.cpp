#include "KVClustering.h"
#include "helpers.h"
#include <cppcms/http_response.h>
#include <cppcms/http_request.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>

namespace oscar_web {


    KVClustering::KVClustering(cppcms::service &srv, const CompletionFileDataPtr &dataPtr) :
            cppcms::application(srv),
            m_dataPtr(dataPtr) {
        dispatcher().assign("/get", &KVClustering::get, this);
        mapper().assign("get", "/get");
    }

    KVClustering::~KVClustering() = default;

    void KVClustering::get() {
        typedef sserialize::Static::spatial::GeoHierarchy GeoHierarchy;
        typedef liboscar::Static::OsmKeyValueObjectStore OsmKeyValueObjectStore;

        sserialize::TimeMeasurer ttm;
        ttm.begin();

        const auto &store = m_dataPtr->completer->store();
        const auto &gh = store.geoHierarchy();

        response().set_content_header("text/json");


        //params
        std::string cqs = request().get("q");
        std::string regionFilter = request().get("rf");
        std::string format = request().get("format");
        std::string clusteringType = request().get("type");
        std::string queryId = request().get("queryId");
        std::string maxRefinements = request().get("maxRefinements");
        std::string exceptionsString = request().get("exceptions");

        bool parsingCorrect = false;

        bool debug = request().get("debug") == "true";

        std::uint8_t mode = 0;
        if (clusteringType == "k")
            mode = 1;
        if (clusteringType == "p")
            mode = 2;

        sserialize::CellQueryResult cqr;
        sserialize::spatial::GeoHierarchySubGraph sg;

        if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
            sg = m_dataPtr->ghSubSetCreators.at(regionFilter);
        } else {
            sg = m_dataPtr->completer->ghsg();
        }
        cqr = m_dataPtr->completer->cqrComplete(cqs, sg, m_dataPtr->treedCQR);
        uint32_t itemCount = cqr.maxItems();


        std::ostream &out = response().out();

        auto numberOfRefinements = static_cast<uint32_t>(std::stoi(maxRefinements));

        std::stringstream debugStr;

        debugStr << R"(,"debugInfo":{"itemCount":)" << itemCount;

        if (mode < 2) {

            if (mode == 0) {

                std::vector<std::pair<uint32_t , uint32_t >> exceptions;

                std::vector<std::vector<uint32_t >> exceptionsVecs = parseJsonArray<std::vector<uint32_t >>(exceptionsString, parsingCorrect);

                for (auto& exceptionVec: exceptionsVecs) {
                    exceptions.emplace_back(exceptionVec[0], exceptionVec[1]);
                }

                std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::vector<uint32_t>> keyValueItemMap;

                generateKeyItemMap(keyValueItemMap, cqr, debugStr, exceptions);

                std::vector<std::pair<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t >> keyValueItemVec;

                sortMap(keyValueItemMap, keyValueItemVec, debugStr);

                out << "{\"clustering\":[";

                writeParentsWithNoIntersection(out, keyValueItemMap, keyValueItemVec,  mode, store, numberOfRefinements, debugStr);

                out << "]";
            } else {
                std::vector<uint32_t> exceptions = parseJsonArray<uint32_t>(exceptionsString, parsingCorrect);

                std::unordered_map<std::uint32_t , std::vector<uint32_t>> keyItemMap;

                generateKeyItemMap(keyItemMap, cqr, debugStr, exceptions);

                std::vector<std::pair<std::uint32_t, uint32_t>> keyItemVec;

                sortMap(keyItemMap, keyItemVec, debugStr);

                out << "{\"clustering\":[";

                writeParentsWithNoIntersection(out, keyItemMap, keyItemVec, mode, store, numberOfRefinements, debugStr);

                out << "]";
            }

        } else {
            sserialize::TimeMeasurer gtm;
            gtm.begin();
            std::unordered_map<std::uint32_t, std::vector<uint32_t>> parentItemMap;

            //get all parents and their items


            for (sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it) {
                const auto &cellParents = sg.cellParents(it.cellId());
                if (!cellParents.empty()) {
                    for (const uint32_t &cellParent : cellParents) {
                        for (const uint32_t &x : it.idx()) {
                            parentItemMap[cellParent].emplace_back(store.at(x).id());
                        }
                    }
                }
            }
            gtm.end();

            debugStr << ",\"timeToGenerateMap\":" << gtm.elapsedMilliSeconds();

            //transform parentItemMap to vector and sort descending by number of keys

            sserialize::TimeMeasurer ctm;
            ctm.begin();

            std::vector<std::pair<std::uint32_t, std::uint32_t >> parentItemVec;

            sortMap(parentItemMap, parentItemVec, debugStr);

            //begin printing

            out << "{\"clustering\":[";

            writeParentsWithNoIntersection(out, parentItemMap, parentItemVec, mode, store, numberOfRefinements, debugStr);

            out << "]";
        }

        if (debug) {
            ttm.end();
            debugStr << ",\"totalTime\":" << ttm.elapsedMilliSeconds();
            debugStr << "}";
            out << debugStr.str();
        }

        out << ",\"queryId\":" + queryId + "}";

        ttm.end();
        writeLogStats("get", cqs, ttm, cqr.cellCount(), itemCount);
    }

    void
    KVClustering::writeLogStats(const std::string &fn, const std::string &query, const sserialize::TimeMeasurer &tm,
                                uint32_t cqrSize, uint32_t idxSize) {
        *(m_dataPtr->log) << "KVClustering::" << fn << ": t=" << tm.beginTime() << "s, rip=" << request().remote_addr()
                          << ", q=[" << query << "], rs=" << cqrSize << " is=" << idxSize << ", ct="
                          << tm.elapsedMilliSeconds() << "ms" << std::endl;
    }

    template<typename mapKey>
    void KVClustering::generateKeyItemMap(
            std::unordered_map<mapKey, std::vector<uint32_t>> &keyItemMap,
            const sserialize::CellQueryResult &cqr, std::stringstream &debug, const std::vector<mapKey>& exceptions) {
        //iterate over all query result items
        sserialize::TimeMeasurer gtm;
        gtm.begin();
        const auto &store = m_dataPtr->completer->store();
        for (sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it) {
            for (const uint32_t& x : it.idx()) {
                const auto& item = store.at(x);
                //iterate over all item keys
                for (uint32_t i = 0; i < item.size(); ++i) {
                    //add key and item to key to keyItemMap
                    insertKey(keyItemMap, item, i, exceptions);
                }
            }
        }
        gtm.end();

        debug << ",\"timeToGenerateMap\":" << gtm.elapsedMilliSeconds();

    }

    //returns true if the number of intersections is greater than minNumber
    bool KVClustering::hasIntersection(const std::vector<uint32_t> &set1, const std::vector<uint32_t> &set2,
                                       const std::float_t &minNumber) {
        std::uint32_t intersectionCount = 0;
        auto itSet1 = set1.begin();
        auto itSet2 = set2.begin();
        while (itSet1 != set1.end() && itSet2 != set2.end()) {
            if (*itSet1 < *itSet2) ++itSet1;
            else if (*itSet2 < *itSet1) ++itSet2;
            else {
                ++itSet1;
                ++itSet2;
                if (++intersectionCount > minNumber) {
                    return true;
                };
            }
        }
        return false;
    }


    template<typename mapKey>
    void KVClustering::writeParentsWithNoIntersection(std::ostream &out,
                                                      const std::unordered_map<mapKey, std::vector  <std::uint32_t >> &parentItemMap,
                                                      const std::vector<std::pair<mapKey, std::uint32_t >> &parentItemVec,
                                                      const std::uint8_t &mode,
                                                      const liboscar::Static::OsmKeyValueObjectStore &store,
                                                      const uint32_t &numberOfRefinements,
                                                      std::stringstream &debugStr) {
        //derive startParents BA-Kopf Page 18
        sserialize::TimeMeasurer fptm;
        fptm.begin();

        std::vector<std::pair<mapKey , std::uint32_t >> result;
        auto itI = parentItemVec.begin() + 1;
        bool startParentsFound = false;
        std::float_t maxNumberOfIntersections;
        for (; itI < parentItemVec.end(); ++itI) {
            for (auto itJ = parentItemVec.begin(); itJ < itI; ++itJ) {
                const std::vector<uint32_t> &setI = parentItemMap.at((*itI).first);
                const std::vector<uint32_t> &setJ = parentItemMap.at((*itJ).first);
                maxNumberOfIntersections = mode == 3 ? 0 : ((*itI).second + (*itJ).second) / 200;
                if (!hasIntersection(setI, setJ, maxNumberOfIntersections)) {
                    // no intersection or required amount
                    // add both parents to results and print them
                    result.emplace_back((*itJ).first,(*itJ).second);
                    result.emplace_back((*itI).first,(*itI).second);

                    printResult((*itJ).first, (*itJ).second, out, mode, store);
                    out << ",";
                    printResult((*itI).first, (*itI).second, out, mode, store);

                    //end the algorithm
                    startParentsFound = true;
                    break;
                }

            }
            if (startParentsFound)
                break;
        }
        fptm.end();
        debugStr << ",\"timeToFindFirstParents\":" << fptm.elapsedMilliSeconds();

        //get other parents which don't have an intersection with the startParents(BA-Kopf page 19)
        sserialize::TimeMeasurer nptm;
        nptm.begin();
        if (startParentsFound) {
            for (auto itK = itI + 1; itK < parentItemVec.end() && result.size() <= numberOfRefinements; ++itK) {
                bool discarded = false;
                for (auto& parentPair : result) {
                    maxNumberOfIntersections =
                            mode == 3 ? 0 : (parentPair.second + (*itK).second) / 200;
                    if (hasIntersection(parentItemMap.at((*itK).first), parentItemMap.at(parentPair.first), maxNumberOfIntersections)) {
                        discarded = true;
                        break;
                    }
                }
                if (!discarded) {
                    //parent does not intersect with previous found parents; add to results and print
                    result.emplace_back(*itK);
                    out << ",";
                    printResult((*itK).first, (*itK).second, out, mode, store);
                }
            }
        }
        nptm.end();

        debugStr << ",\"timeToFindOtherParents\":" << nptm.elapsedMilliSeconds();

    }

    void KVClustering::printResult(const std::uint32_t &id, const long &itemCount, std::ostream &out,
                                   const std::uint8_t &mode,
                                   const liboscar::Static::OsmKeyValueObjectStore &store) {
        const auto &gh = store.geoHierarchy();
        sserialize::JsonEscaper je;

        if (mode == 1) {
            out << R"({"name": ")" << je.escape(store.keyStringTable().at(id)) << R"(", "itemCount":)" << itemCount
                << ",\"id\":" << id << "}";
        } else if (mode == 2) {
            out << R"({"name": ")" << je.escape(store.at(gh.ghIdToStoreId(id)).value("name"))
                << R"(", "itemCount":)" << itemCount
                << ",\"id\":" << id << "}";
        }
    }

    void KVClustering::printResult(const std::pair<std::uint32_t, std::uint32_t> &id, const long &itemCount,
                                   std::ostream &out, const std::uint8_t &mode,
                                   const liboscar::Static::OsmKeyValueObjectStore &store) {
        sserialize::JsonEscaper je;
        out << R"({"name": ")" << je.escape(store.keyStringTable().at(id.first)) << ":"
            << je.escape(store.valueStringTable().at(id.second)) << R"(", "itemCount":)" << itemCount
            << ",\"keyId\":" << id.first << ",\"valueId\":" << id.second << "}";
    }

    template<typename mapKey>
    void KVClustering::sortMap(std::unordered_map<mapKey, std::vector<uint32_t>> &parentItemMap,
                               std::vector<std::pair<mapKey, uint32_t>> &parentItemVec,
                               std::stringstream &debug) {

        sserialize::TimeMeasurer ctm;
        ctm.begin();

        auto parentCount = static_cast<uint32_t>(parentItemMap.size());

        debug << ",\"parentCount\":" << parentCount;

        uint32_t pairCount = 0;


        for(auto& parent : parentItemMap){
           std::sort(parent.second.begin(), parent.second.end());
           parentItemVec.emplace_back(std::make_pair(parent.first, parent.second.size()));
           pairCount += parent.second.size();
        }
        debug << ",\"pairCount\":" << pairCount;


        ctm.end();
        debug << ",\"timeToCopy\":" << ctm.elapsedMilliSeconds();

        sserialize::TimeMeasurer stm;
        stm.begin();
        std::sort(parentItemVec.begin(), parentItemVec.end(),
                  [](std::pair<mapKey, std::uint32_t> const &a,
                     std::pair<mapKey, std::uint32_t> const &b) {
                      return a.second != b.second ? a.second > b.second : a.first < b.first;
                  });


        stm.end();
        debug << ",\"timeToSort\":" << stm.elapsedMilliSeconds();

    }

    void KVClustering::insertKey(std::unordered_map<std::uint32_t, std::vector<uint32_t>> &keyItemMap,
                                 const liboscar::Static::OsmKeyValueObjectStoreItem &item, const uint32_t &i,
                                 const std::vector<uint32_t>& exceptions) {
        if(std::find(exceptions.begin(), exceptions.end(), item.keyId(i)) == exceptions.end())
        keyItemMap[item.keyId(i)].emplace_back(item.id());
    }

    void KVClustering::insertKey(std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::vector<uint32_t>> &keyValueItemMap,
                                const liboscar::Static::OsmKeyValueObjectStoreItem &item, const uint32_t &i,
                                const std::vector<std::pair<std::uint32_t , std::uint32_t >>& exceptions) {
        const std::pair<std::uint32_t , std::uint32_t >& keyValuePair = std::make_pair(item.keyId(i), item.valueId(i));
        if(std::find(exceptions.begin(), exceptions.end(), keyValuePair) == exceptions.end())
            keyValueItemMap[keyValuePair].emplace_back(item.id());
    }
}//end namespace oscar_web
