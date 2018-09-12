#include "KVClustering.h"
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

        debugStr << ",\"debugInfo\":{";

        if (mode < 2) {

            auto keyItemMap = std::unordered_map<std::uint32_t, std::set<uint32_t>>();

            auto keyValueItemMap = std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::set<uint32_t>>();

            kvClustering(keyItemMap, keyValueItemMap, cqr, mode, debugStr);


            if (mode == 0) {

                sserialize::TimeMeasurer stm;

                stm.begin();
                auto keyValueItemVec = std::vector<std::pair<std::pair<std::uint32_t, std::uint32_t>, std::set<uint32_t>>>();

                std::copy(keyValueItemMap.begin(), keyValueItemMap.end(),
                          std::back_inserter<std::vector<std::pair<std::pair<std::uint32_t, std::uint32_t>, std::set<uint32_t>>>>(
                                  keyValueItemVec));

                std::sort(keyValueItemVec.begin(), keyValueItemVec.end(),
                          [](std::pair<std::pair<std::uint32_t, std::uint32_t>, std::set<uint32_t>> const &a,
                             std::pair<std::pair<std::uint32_t, std::uint32_t>, std::set<uint32_t>> const &b) {
                              return a.second.size() != b.second.size() ? a.second.size() > b.second.size() :
                                     a.first.first < b.first.first || a.first.second < b.first.second;
                          });
                stm.end();
                debugStr << ",\"timeToSort\":" << stm.elapsedMilliSeconds();

                out << "{\"clustering\":[";

                writeParentsWithNoIntersection(out, keyValueItemVec, mode, store, numberOfRefinements, debugStr);


                out << "]";
            } else {
                std::vector<std::pair<std::uint32_t, std::set<uint32_t>>> keyItemVec;

                sortMap(keyItemMap, keyItemVec, debugStr);

                out << "{\"clustering\":[";

                writeParentsWithNoIntersection(out, keyItemVec, mode, store, numberOfRefinements, debugStr);

                out << "]";
            }

        } else if (clusteringType == "p") {
            sserialize::TimeMeasurer gtm;
            gtm.begin();
            auto parentItemMap = std::unordered_map<std::uint32_t, std::set<uint32_t>>();

            //get all parents and their items

            for (sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it) {
                auto cellParents = sg.cellParents(it.cellId());
                if (!cellParents.empty()) {
                    for (uint32_t &cellParent : cellParents) {
                        for (uint32_t x : it.idx()) {
                            auto item = store.at(x);
                            parentItemMap[cellParent].insert(item.id());
                        }
                    }
                }
            }
            gtm.end();

            debugStr << "\"timeToGenerateMap\":" << gtm.elapsedMilliSeconds();

            //transform parentItemMap to vector and sort descending by number of keys

            std::vector<std::pair<std::uint32_t, std::set<uint32_t>>> parentItemVec;

            sortMap(parentItemMap, parentItemVec, debugStr);

            //begin printing

            out << "{\"clustering\":[";

            writeParentsWithNoIntersection(out, parentItemVec, mode, store, numberOfRefinements, debugStr);

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

    void KVClustering::kvClustering(
            std::unordered_map<std::uint32_t, std::set<uint32_t>> &keyItemMap,
            std::unordered_map<std::pair<std::uint32_t, std::uint32_t>, std::set<uint32_t>> &keyValueItemMap,
            const sserialize::CellQueryResult &cqr, const std::uint8_t &mode, std::stringstream &debug) {
        //iterate over all query result items
        sserialize::TimeMeasurer gtm;
        gtm.begin();
        const auto &store = m_dataPtr->completer->store();
        for (sserialize::CellQueryResult::const_iterator it(cqr.begin()), end(cqr.end()); it != end; ++it) {
            for (uint32_t x : it.idx()) {
                auto item = store.at(x);
                //iterate over all item keys
                for (uint32_t i = 0; i < item.size(); ++i) {
                    uint32_t key = item.keyId(i);
                    uint32_t value = item.valueId(i);
                    auto keyValuePair = std::make_pair(key, value);
                    //add key and item to key to keyItemMap
                    if (mode == 1)
                        keyItemMap[key].insert(item.id());

                    if (mode == 0)
                        keyValueItemMap[keyValuePair].insert(item.id());
                }
            }
        }
        gtm.end();

        debug << "\"timeToGenerateMap\":" << gtm.elapsedMilliSeconds();

    }

    //returns true if the number of intersections is greater than minNumber
    bool KVClustering::hasIntersection(const std::set<uint32_t> &set1, const std::set<uint32_t> &set2,
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
                                                      const std::vector<std::pair<mapKey, std::set<uint32_t>>> &parentItemVec,
                                                      const std::uint8_t &mode,
                                                      const liboscar::Static::OsmKeyValueObjectStore &store,
                                                      const uint32_t &numberOfRefinements,
                                                      std::stringstream &debug) {
        //derive startParents BA-Kopf Page 18
        sserialize::TimeMeasurer fptm;
        fptm.begin();

        auto result = std::vector<std::pair<mapKey, std::set<uint32_t >>>();
        auto itI = parentItemVec.begin() + 1;
        bool startParentsFound = false;
        std::float_t maxNumberOfIntersections;
        for (; itI < parentItemVec.end(); ++itI) {
            for (auto itJ = parentItemVec.begin(); itJ < itI; ++itJ) {
                auto parentI = (*itI).first;
                auto parentJ = (*itJ).first;
                std::set<uint32_t> setI = (*itI).second;
                std::set<uint32_t> setJ = (*itJ).second;
                maxNumberOfIntersections = mode == 3 ? 0 : (setI.size() + setJ.size()) / 200;
                if (!hasIntersection(setI, setJ, maxNumberOfIntersections)) {
                    // no intersection or required amount
                    // add both parents to results and print them
                    result.emplace_back(parentJ, setJ);
                    result.emplace_back(parentI, setI);

                    printResult(parentJ, setJ.size(), out, mode, store);
                    out << ",";
                    printResult(parentI, setI.size(), out, mode, store);

                    //end the algorithm
                    startParentsFound = true;
                    break;
                }

            }
            if (startParentsFound)
                break;
        }
        fptm.end();
        debug << ",\"timeToFindFirstParents\":" << fptm.elapsedMilliSeconds();

        //get other parents which don't have an intersection with the startParents(BA-Kopf page 19)
        sserialize::TimeMeasurer nptm;
        nptm.begin();
        if (startParentsFound) {
            for (auto itK = itI + 1; itK < parentItemVec.end() && result.size() <= numberOfRefinements; ++itK) {
                bool discarded = false;
                for (auto parentPair : result) {
                    maxNumberOfIntersections =
                            mode == 3 ? 0 : (parentPair.second.size() + (*itK).second.size()) / 200;
                    if (hasIntersection((*itK).second, parentPair.second, maxNumberOfIntersections)) {
                        discarded = true;
                        break;
                    }
                }
                if (!discarded) {
                    //parent does not intersect with previous found parents; add to results and print
                    result.emplace_back(*itK);
                    auto parentId = (*itK).first;
                    auto itemCount = (*itK).second.size();
                    out << ",";
                    printResult(parentId, itemCount, out, mode, store);
                }
            }
        }
        nptm.end();

        debug << ",\"timeToFindOtherParents\":" << nptm.elapsedMilliSeconds();
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
            << ",\"id\":" << id.first << ",\"valueId\":" << id.second << "}";
    }

    void KVClustering::sortMap(std::unordered_map<std::uint32_t, std::set<uint32_t>> &parentItemMap,
                               std::vector<std::pair<std::uint32_t, std::set<uint32_t>>> &parentItemVec,
                               std::stringstream &debug) {

        sserialize::TimeMeasurer stm;
        stm.begin();
        std::copy(parentItemMap.begin(), parentItemMap.end(),
                  std::back_inserter<std::vector<std::pair<std::uint32_t, std::set<uint32_t>>>>(parentItemVec));

        std::sort(parentItemVec.begin(), parentItemVec.end(),
                  [](std::pair<std::uint32_t, std::set<uint32_t>> const &a,
                     std::pair<std::uint32_t, std::set<uint32_t>> const &b) {
                      return a.second.size() != b.second.size() ? a.second.size() > b.second.size() : a.first < b.first;
                  });

        stm.end();
        debug << ",\"timeToSort\":" << stm.elapsedMilliSeconds();

    }

}//end namespace oscar_web
