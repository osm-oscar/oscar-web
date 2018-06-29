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
	std::string escapeJsonString(const std::string &input);
};



}//end namespace

#endif
