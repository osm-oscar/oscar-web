#ifndef OSCAR_WEB_TYPES_H
#define OSCAR_WEB_TYPES_H
#include <memory>
#include <vector>
#include <fstream>
#include <unordered_map>
#include <liboscar/StaticOsmCompleter.h>
#include <path_finder/storage/FileLoader.h>


namespace oscar_web {

typedef std::shared_ptr<liboscar::Static::OsmCompleter> OsmCompleter;

struct CompletionFileData {
	CompletionFileData() :
	limit(32),
	chunkLimit(8),
	minStrLen(3),
	fullSubSetLimit(100),
	maxIndexDBReq(10),
	maxItemDBReq(10),
	cachedGeoHierarchy(true),
	treedCQR(false),
	treedCQRThreads(1),
	cqrdCacheThreshold(0),
	geocompleter(0)
	{}
	//Info from config file
	std::string path;
	std::string name;
	std::string logFilePath;
	uint32_t limit;
	uint32_t chunkLimit;
	uint32_t minStrLen;
	uint32_t fullSubSetLimit;
	uint32_t maxIndexDBReq;
	uint32_t maxItemDBReq;
	uint32_t maxResultDownloadSize;
	bool cachedGeoHierarchy;
	bool treedCQR;
	uint32_t treedCQRThreads;
	uint32_t cqrdCacheThreshold;
	std::unordered_map<uint8_t, uint8_t> textSearchers;
	uint32_t geocompleter;
	//runtime data
	OsmCompleter completer;
	std::shared_ptr<std::ofstream> log;
	std::unordered_map<std::string, sserialize::spatial::GeoHierarchySubGraph> ghSubSetCreators;
	std::vector< std::pair<double, double> > regionMidPoints;
	std::vector< std::pair<double, double> > cellMidPoints;
	std::shared_ptr<pathFinder::HybridPathFinder> hybridPathFinder;
};



typedef std::shared_ptr< CompletionFileData>  CompletionFileDataPtr;

}//end namespace

#endif
