#include "CQRCompleter.h"
#include "BinaryWriter.h"
#include "helpers.h"
#include <cppcms/http_response.h>
#include <cppcms/http_request.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>
#include <cppcms/json.h>
#include <sserialize/Static/GeoHierarchy.h>
#include <sserialize/stats/TimeMeasuerer.h>
#include <sserialize/utility/printers.h>

namespace oscar_web {

void CQRCompleter::writeLogStats(const std::string & fn, const std::string& query, const sserialize::TimeMeasurer& tm, uint32_t cqrSize, uint32_t idxSize) {
	*(m_dataPtr->log) << "CQRCompleter::" << fn << ": t=" << tm.beginTime() << "s, rip=" << request().remote_addr() << ", q=[" << query << "], rs=" << cqrSize <<  " is=" << idxSize << ", ct=" << tm.elapsedMilliSeconds() << "ms" << std::endl;
}

std::unordered_map< uint32_t, std::pair< double, double > >
CQRCompleter::getClusterCenters(sserialize::Static::spatial::GeoHierarchy::SubSet& subSet)
{
	//calcs in ghId!
	struct Calc {
		std::unordered_map<uint32_t, std::pair<double, double> > clusterCenters;
		const sserialize::CellQueryResult & cqr;
		const sserialize::Static::spatial::GeoHierarchy & gh;
		const CompletionFileDataPtr & dataPtr;
		Calc(const sserialize::CellQueryResult & cqr, const CompletionFileDataPtr & dataPtr) :
		cqr(cqr), gh(dataPtr->completer->store().geoHierarchy()), dataPtr(dataPtr)
		{}

		void calc(const sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr & p) {
			if (clusterCenters.count(p->ghId())) {
				return;
			}
			if (p->size()) {
				for(auto x : *p) {
					calc(x);
				}
				std::pair<double, double> tmp(0.0, 0.0);
				for(auto x : *p) {
					const auto & d = clusterCenters.at(x->ghId());
					tmp.first += d.first;
					tmp.second += d.second;
				}
				tmp.first /= p->size();
				tmp.second /= p->size();
				clusterCenters.emplace(p->ghId(), tmp);
			}
			else if (p->cellPositions().size()) {//use the cells
				std::pair<double, double> tmp(0.0, 0.0);
				for(uint32_t cellPos : p->cellPositions()) {
					uint32_t cellId = cqr.cellId(cellPos);
					const auto & midPoint = dataPtr->cellMidPoints.at(cellId);
					tmp.first += midPoint.first;
					tmp.second += midPoint.second;
				}
				tmp.first /= p->cellPositions().size();
				tmp.second /= p->cellPositions().size();
				clusterCenters.emplace(p->ghId(), tmp);
			}
			else {
				clusterCenters.emplace(p->ghId(), dataPtr->regionMidPoints.at(p->ghId()));
			}
		}
	};
	Calc calc(subSet.cqr(), m_dataPtr);
	
	calc.calc(subSet.root());
	
	return calc.clusterCenters;
}


CQRCompleter::CQRCompleter(cppcms::service& srv, const CompletionFileDataPtr & dataPtr) :
application(srv),
m_dataPtr(dataPtr),
m_subSetSerializer(dataPtr->completer->store().geoHierarchy()),
m_cqrSerializer(dataPtr->completer->indexStore().indexType())
{
	dispatcher().assign("/clustered/full", &CQRCompleter::fullCQR, this);
	dispatcher().assign("/clustered/simple", &CQRCompleter::simpleCQR, this);
	dispatcher().assign("/clustered/children", &CQRCompleter::children, this);
	dispatcher().assign("/clustered/childreninfo", &CQRCompleter::childrenInfo, this);
	dispatcher().assign("/clustered/cells", &CQRCompleter::cells, this);
	dispatcher().assign("/clustered/cellitems", &CQRCompleter::cellItems, this);
	dispatcher().assign("/clustered/michildren", &CQRCompleter::maximumIndependentChildren, this);
	dispatcher().assign("/clustered/items", &CQRCompleter::items, this);
	dispatcher().assign("/clustered/dag", &CQRCompleter::dag, this);
	dispatcher().assign("/clustered/clusterhints", &CQRCompleter::clusterHints, this);
	mapper().assign("clustered","/clustered");
}

CQRCompleter::~CQRCompleter() {}


void CQRCompleter::writeSubSet(std::ostream& out, const std::string & sst, const sserialize::Static::spatial::GeoHierarchy::SubSet& subSet) {
	if (sst == "flatxml") {
		m_subSetSerializer.toFlatXML(out, subSet);
	}
	else if (sst == "treexml") {
		m_subSetSerializer.toTreeXML(out, subSet);
	}
	else if (sst == "flatjson") {
		m_subSetSerializer.toJson(out, subSet);
	}
	else if (sst == "binary") {
		m_subSetSerializer.toBinary(out, subSet);
	}
}

void CQRCompleter::writeDag(std::ostream& out, const std::string & sst, const sserialize::Static::spatial::GeoHierarchy::SubSet& subSet) {
	if (sst == "flatjson") {
		m_subSetSerializer.dagJson(out, subSet);
	}
}

void CQRCompleter::fullCQR() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();

	std::string cqs = request().get("q");
	std::string regionFilter = request().get("rf");
	std::string sst = request().get("sst");
	bool ssonly = sserialize::toBool(request().get("ssonly"));
	
	sserialize::Static::spatial::GeoHierarchy::SubSet subSet;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	
	if (!ssonly || sst == "binary") {
		response().set_content_header("application/octet-stream");
	}
	else {
		if (sst == "flatjson") {
			response().set_content_header("text/json");
		}
		else {
			response().set_content_header("application/xml");
		}
	}
	
	std::ostream & out = response().out();

	if (!ssonly) {
		m_cqrSerializer.write(out, subSet.cqr());
	}
	writeSubSet(out, sst, subSet);
	
	ttm.end();
	writeLogStats("fullCQR", cqs, ttm, subSet.cqr().cellCount(), 0);
}

void CQRCompleter::simpleCQR() {
	typedef sserialize::Static::spatial::GeoHierarchy GeoHierarchy;
	typedef std::unordered_set<const GeoHierarchy::SubSet::Node*> RegionSet;
	
	sserialize::TimeMeasurer ttm;
	ttm.begin();

	const auto & gh = m_dataPtr->completer->store().geoHierarchy();

	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().get("q");
	std::string regionFilter = request().get("rf");
	uint32_t cqrSize = 0;
	double ohf = 0.0;
	bool globalUnfoldRatio = true;

	//local
	RegionSet regions;
	std::vector<uint32_t> ohPath;
	SubSetNodePtr subSetRootPtr;
	
	{
		std::string tmpStr = request().get("oh");
		if (!tmpStr.empty()) {
			ohf = atof(tmpStr.c_str());
			if (ohf >= 1.0 || ohf < 0.0) {
				ohf = 0.0;
			}
		}
		tmpStr = request().get("oht");
		if (tmpStr == "relative") {
			globalUnfoldRatio = false;
		}
	}
	
	GeoHierarchy::SubSet subSet;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	
	GeoHierarchy::SubSet::NodePtr rPtr(subSet.root());
	subSetRootPtr = rPtr;
	cqrSize = subSet.cqr().cellCount(); //for stats
	if (ohf != 0.0) {
		struct MyIterator {
			std::vector<uint32_t> * ohPath;
			RegionSet * regions;
			const GeoHierarchy * gh;
			MyIterator & operator*() { return *this; }
			MyIterator & operator++() { return *this; }
			MyIterator & operator=(const SubSetNodePtr & node) {
				uint32_t storeId = gh->ghIdToStoreId( node->ghId() );
				ohPath->push_back(storeId);
				regions->insert(node.get());
				return *this;
			}
			MyIterator(std::vector<uint32_t> * ohPath, RegionSet * regions, const GeoHierarchy * gh) :
			ohPath(ohPath), regions(regions), gh(gh)
			{}
		};
		
		subSet.pathToBranch(MyIterator(&ohPath, &regions, &gh), ohf, globalUnfoldRatio);
	}
	//now write the data
	BinaryWriter bw(response().out());

	//root region apx item count
	bw.putU32(subSetRootPtr->maxItemsSize());
	
	//ohPath
	bw.putU32(ohPath.size());
	for(auto x : ohPath) {
		bw.putU32(x);
	}
	bw.putU32(regions.size()+1);
	bw.putU32(subSetRootPtr->size()*2+1);
	bw.putU32(0xFFFFFFFF);//root node id
	for(const SubSetNodePtr & x : *subSetRootPtr) {
		bw.putU32( gh.ghIdToStoreId(x->ghId()) );
		bw.putU32( x->maxItemsSize() );
	}
	for(auto x : regions) {
		bw.putU32(x->size()*2+1);
		bw.putU32( gh.ghIdToStoreId(x->ghId()) );
		for(const SubSetNodePtr & c : *x) {
			bw.putU32( gh.ghIdToStoreId(c->ghId()) );
			bw.putU32( c->maxItemsSize() );
		}
	}

	ttm.end();
	writeLogStats("simpleCQR", cqs, ttm, cqrSize, 0);
}

void CQRCompleter::items() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	
	const auto & gh = m_dataPtr->completer->store().geoHierarchy();

	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().get("q");
	std::string regionFilter = request().get("rf");
	uint32_t numItems = 0;
	uint32_t skipItems = 0;
	uint32_t cqrSize = 0;

	
	{
		std::string tmpStr = request().get("k");
		if (!tmpStr.empty()) {
			numItems = std::min<uint32_t>(m_dataPtr->maxItemDBReq, atoi(tmpStr.c_str()));
		}
		tmpStr = request().get("o");
		if (!tmpStr.empty()) {
			skipItems = atoi(tmpStr.c_str());
		}
	}
	
	sserialize::CellQueryResult cqr;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		cqr = m_dataPtr->completer->cqrComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		cqr = m_dataPtr->completer->cqrComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	
	sserialize::ItemIndex idx(cqr.topK(numItems+skipItems));
	cqrSize = cqr.cellCount();
	
	//now write the data
	BinaryWriter bw(response().out());
	if (skipItems >= idx.size()) {
		bw.putU32(0);
	}
	else {
		numItems = std::min<uint32_t>(idx.size() - skipItems, numItems);
		bw.putU32(numItems);
		for(uint32_t i(skipItems), s(skipItems+numItems); i < s; ++i) {
			bw.putU32(idx.at(i));
		}
	}

	ttm.end();
	writeLogStats("items", cqs, ttm, cqrSize, idx.size());
}


void CQRCompleter::children() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	
	const sserialize::Static::spatial::GeoHierarchy & gh = m_dataPtr->completer->store().geoHierarchy();

	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().get("q");
	std::string regionFilter = request().get("rf");
	uint32_t regionId = sserialize::Static::spatial::GeoHierarchy::npos;
	uint32_t cqrSize = 0;

	{
		std::string tmpStr = request().get("r");
		if (!tmpStr.empty()) {
			regionId = atoi(tmpStr.c_str());
		}
	}
	
	if (regionId != sserialize::Static::spatial::GeoHierarchy::npos) {
		cqs = sserialize::toString("$region:", regionId, " (", cqs, ")");
	}

	sserialize::Static::spatial::GeoHierarchy::SubSet subSet;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	
	sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr rPtr(regionId != sserialize::Static::spatial::GeoHierarchy::npos ? subSet.regionByStoreId(regionId) : subSet.root());
	cqrSize = subSet.cqr().cellCount(); //for stats

	//now write the data
	BinaryWriter bw(response().out());
	if (rPtr) {
		bw.putU32(rPtr->size()*2);
		for(const SubSetNodePtr & x : *rPtr) {
		bw.putU32( gh.ghIdToStoreId(x->ghId()) );
			bw.putU32( x->maxItemsSize() );
		}
	}
	else {
		bw.putU32(0);
	}

	ttm.end();
	writeLogStats("children", cqs, ttm, cqrSize, 0);
}

template<bool T_WITH_CELLS, bool T_WITH_CLUSTERHINTS>
struct ChildrenInfoWriter {
	typedef sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr NodePtr;

	///interleaved: { <parentRegionId>: {<childId>: {apxitems: <int>, cells:[]}, ...}
	static void writeInterleaved(std::ostream & out,
		sserialize::Static::spatial::GeoHierarchy::SubSet & subSet,
		const std::vector<uint32_t> & regions,
		const std::unordered_map<uint32_t, std::pair<double, double> > & clusterHints)
	{
		out.precision(10);
		const auto & gh = subSet.cqr().geoHierarchy();
		char sep = '{';
		for(uint32_t regionId : regions) {
			NodePtr rPtr(regionId != sserialize::Static::spatial::GeoHierarchy::npos ? subSet.regionByStoreId(regionId) : subSet.root());
			if (!rPtr) {
				continue;
			}
			out << sep;
			sep = ',';
			out << '"' << regionId << "\":";
			char mySep = '{';
			for(const NodePtr & child : *rPtr) {
				out << mySep;
				mySep = ',';
				out << '"' << gh.ghIdToStoreId( child->ghId() ) << "\":{\"apxitems\":" << child->maxItemsSize();
				if (T_WITH_CLUSTERHINTS) {
					const auto & p = clusterHints.at(child->ghId());
					out << ",\"clusterHint\":[" << p.first << ',' << p.second << ']';
				}
				if (T_WITH_CELLS) {
					out << ",\"cells\":";
					if (child->cellPositions().size()) {
						char mySep = '[';
						for(uint32_t cellPos : child->cellPositions()) {
							uint32_t cellId = subSet.cqr().cellId(cellPos);
							out << mySep;
							mySep = ',';
							out << cellId;
						}
						out << ']';
					}
					else {
						out << "[]";
					}
				}
				else {
					out << '}';
				}
			}
			if (mySep == '{') {
				out << mySep;
			}
			out << '}';
		}
		if (sep == '{') {
			out << sep;
		}
		out << '}';
	}
	///graph style: { graph: { regionId: [childId]}, regionInfo: { regionId: { apxitems: <int>, cells: [], clusterHint}} }
	static void writeGraph(std::ostream & out,
		sserialize::Static::spatial::GeoHierarchy::SubSet & subSet,
		const std::vector<uint32_t> & regions,
		const std::unordered_map<uint32_t, std::pair<double, double> > & clusterHints)
	{
		std::unordered_map<uint32_t, NodePtr> children;
		out.precision(10);
		const auto & gh = subSet.cqr().geoHierarchy();
		out << '{' << "\"graph\":";
		char sep = '{';
		for(uint32_t regionId : regions) {
			NodePtr rPtr(regionId != sserialize::Static::spatial::GeoHierarchy::npos ? subSet.regionByStoreId(regionId) : subSet.root());
			if (!rPtr || !rPtr->size()) {
				continue;
			}
			out << sep << gh.ghIdToStoreId( rPtr->ghId() ) << '[';
			sep = ',';
			auto cIt( rPtr->cbegin());
			out << gh.ghIdToStoreId( (*cIt)->ghId() );
			if (!children.count((*cIt)->ghId())) {
				children[(*cIt)->ghId()] = *cIt;
			}
			++cIt;
			for(auto cEnd(rPtr->cend()); cIt != cEnd; ++cIt) {
				out << ',' << gh.ghIdToStoreId( (*cIt)->ghId() );
				if (!children.count((*cIt)->ghId())) {
					children[(*cIt)->ghId()] = *cIt;
				}
			}
			out << ']';
		}
		if (sep == '{') {
			out << '}';
		}
		out << '}'; // end of graph
		
		//now take care of children
		out << ", \"regionInfo\":";
		sep = '{';
		for(const auto & tmp : children) {
			const auto & child = tmp.second;
			out << sep;
			sep = ',';
			out << '"' << gh.ghIdToStoreId( tmp.first ) << "\":{\"apxitems\":" << child->maxItemsSize();
			if (T_WITH_CLUSTERHINTS) {
				const auto & p = clusterHints.at(tmp.first);
				out << ",\"clusterHint\":[" << p.first << ',' << p.second << ']';
			}
			if (T_WITH_CELLS) {
				out << ",\"cells\":";
				if (child->cellPositions().size()) {
					char mySep = '[';
					for(uint32_t cellPos : child->cellPositions()) {
						uint32_t cellId = subSet.cqr().cellId(cellPos);
						out << mySep;
						mySep = ',';
						out << cellId;
					}
					out << ']';
				}
				else {
					out << "[]";
				}
			}
			else {
				out << '}';
			}
		}
		if (sep == '{') {
			out << '}';
		}
		out << '}'; // end of children info
		
		out << '}'; //end of outer object
	}
	static void write(std::ostream & out,
		sserialize::Static::spatial::GeoHierarchy::SubSet & subSet,
		const std::vector<uint32_t> & regions,
		const std::unordered_map<uint32_t, std::pair<double, double> > & clusterHints)
	{
		writeInterleaved(out, subSet, regions, clusterHints);
	}
};

void CQRCompleter::childrenInfo() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	
	const sserialize::Static::spatial::GeoHierarchy & gh = m_dataPtr->completer->store().geoHierarchy();

	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().post("q");
	std::string regionFilter = request().post("rf");
	bool withCells = sserialize::toBool( request().post("withCells") );
	bool withClusterHints = sserialize::toBool( request().post("withClusterHints") );
	std::vector<uint32_t> regions;
	{
		bool ok;
		std::vector<uint32_t> tmp( parseJsonArray<uint32_t>(request().post("which"), ok) );
		if (!ok) {
			response().out() << "Invalid request";
			return;
		}
		regions.reserve(tmp.size());
		uint32_t maxR = gh.regionSize();
		for(uint32_t x : tmp) {
			if (x < maxR || x == sserialize::Static::spatial::GeoHierarchy::npos) {
				regions.emplace_back(x);
			}
		}
		if (!regions.size()) {
			regions.emplace_back(sserialize::Static::spatial::GeoHierarchy::npos);
		}
	}
	
	if (regions.size() == 1 && regions.front() != sserialize::Static::spatial::GeoHierarchy::npos) {
		cqs = sserialize::toString("$region:", regions.front(), " (", cqs, ")");
	}

	uint32_t fullSubSetLimit = (withCells ? 0xFFFFFFFF : m_dataPtr->fullSubSetLimit);
	sserialize::Static::spatial::GeoHierarchy::SubSet subSet;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, fullSubSetLimit, m_dataPtr->treedCQR);
	}
	
	std::ostream & out = response().out();
	std::unordered_map<uint32_t, std::pair<double, double> > ch;
	if (withClusterHints) {
		ch = getClusterCenters(subSet);
		if (withCells) {
			ChildrenInfoWriter<true, true>::write(out, subSet, regions, ch);
		}
		else {
			ChildrenInfoWriter<false, true>::write(out, subSet, regions, ch);
		}
	}
	else {
		if (withCells) {
			ChildrenInfoWriter<true, false>::write(out, subSet, regions, ch);
		}
		else {
			ChildrenInfoWriter<false, false>::write(out, subSet, regions, ch);
		}
	}
	
	ttm.end();
	writeLogStats("childrenInfo", cqs, ttm, subSet.cqr().cellCount(), 0);
}

void CQRCompleter::cells() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	
	const auto & gh = m_dataPtr->completer->store().geoHierarchy();

	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().get("q");
	
	sserialize::CellQueryResult cqr( m_dataPtr->completer->cqrComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR) );
	
	std::ostream & out = response().out();
	out << '[';
	if (cqr.cellCount()) {
		out << cqr.cellId(0);
	}
	for(uint32_t i(1), s(cqr.cellCount()); i < s; ++i) {
		out << ',' << cqr.cellId(i);
	}
	out << ']';
	ttm.end();
	writeLogStats("cells", cqs, ttm, cqr.cellCount(), 0);
}

void CQRCompleter::cellItems() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	
	const auto & gh = m_dataPtr->completer->store().geoHierarchy();

	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().post("q");
	std::string regionFilter = request().post("rf");
	uint32_t numItems = 0;
	uint32_t skipItems = 0;
	uint32_t cqrSize = 0;
	bool ok;
	std::vector<uint32_t> rqCId( parseJsonArray<uint32_t>(request().post("which"), ok) );
	
	if (!ok) {
		std::ostream & out = response().out();
		out << "Invalid request!";
		return;
	}

	{
		std::string tmpStr = request().post("k");
		if (!tmpStr.empty()) {
			numItems = std::min<uint32_t>(m_dataPtr->maxItemDBReq, atoi(tmpStr.c_str()));
		}
		tmpStr = request().post("o");
		if (!tmpStr.empty()) {
			skipItems = atoi(tmpStr.c_str());
		}
	}
	
	if (!numItems) {
		response().out() << "{}";
		return;
	}
	
	sserialize::CellQueryResult cqr;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		cqr = m_dataPtr->completer->cqrComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		cqr = m_dataPtr->completer->cqrComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	std::ostream & out = response().out();
	char sep = '{';
	for(uint32_t cIt(0), rIt(0), cS(cqr.cellCount()), rS(rqCId.size()); cIt < cS && rIt < rS;) {
		uint32_t cqrCellId = cqr.cellId(cIt);
		if (cqrCellId == rqCId.at(rIt)) {
			out << sep;
			sep = ',';
			out << '"' << cqrCellId << "\":[";
			SSERIALIZE_CHEAP_ASSERT_LARGER(cqr.idxSize(cIt), 0);
			sserialize::ItemIndex idx(cqr.idx(cIt));
			sserialize::ItemIndex::const_iterator idxIt(idx.begin());
			if (idx.size() > skipItems) {
				idxIt += skipItems;
				out << *idxIt;
				++idxIt;
				for(uint32_t i(1), s(std::min<uint32_t>(idx.size()-skipItems, numItems)); i < s; ++idxIt, ++i) {
					out << ',' << *idxIt;
				}
			}
			out << ']';
			++cIt;
			++rIt;
		}
		else if (cqrCellId < rqCId[rIt]) {
			++cIt;
		}
		else {
			++rIt;
		}
	}
	if (sep == '{') {
		out << sep;
	}
	out << '}';

	ttm.end();
	writeLogStats("cellItems", cqs, ttm, cqr.cellCount(), 0);
}

void CQRCompleter::maximumIndependentChildren() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	
	const sserialize::Static::spatial::GeoHierarchy & gh = m_dataPtr->completer->store().geoHierarchy();

	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().get("q");
	std::string regionFilter = request().get("rf");
	uint32_t regionId = sserialize::Static::spatial::GeoHierarchy::npos;
	uint32_t cqrSize = 0;
	uint32_t overlap = 0;

	{
		std::string tmpStr = request().get("r");
		if (!tmpStr.empty()) {
			regionId = atoi(tmpStr.c_str());
		}
		
		tmpStr = request().get("o");
		if (!tmpStr.empty()) {
			overlap = atoi(tmpStr.c_str());
		}
	}
	
	if (regionId != sserialize::Static::spatial::GeoHierarchy::npos) {
		cqs = sserialize::toString("$region:", regionId, " (", cqs, ")");
	}
	
	sserialize::Static::spatial::GeoHierarchy::SubSet subSet;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	
	sserialize::Static::spatial::GeoHierarchy::SubSet::NodePtr rPtr(regionId != sserialize::Static::spatial::GeoHierarchy::npos ? subSet.regionByStoreId(regionId) : subSet.root());
	cqrSize = subSet.cqr().cellCount(); //for stats

	//now write the data
	std::ostream & out = response().out();
	if (rPtr && rPtr->size()) {
		char delim = '[';
		std::vector<uint32_t> pickedRegions;
		std::vector< std::pair<uint32_t, uint32_t> > count2Pos;
		for(uint32_t i(0), s(rPtr->size()); i < s; ++i) {
			count2Pos.emplace_back(rPtr->at(i)->maxItemsSize(), i);
		}
		std::sort(count2Pos.begin(), count2Pos.end(), std::greater< std::pair<uint32_t, uint32_t> >());
		std::unordered_set<uint32_t> pickedCellPositions;
		if (subSet.sparse()) {
			std::vector<uint32_t> currentChildCellPositions;
			struct Calc {
				std::unordered_set<uint32_t> * pickedCellPositions;
				std::vector<uint32_t> * currentChildCellPositions;
				bool operator()(const SubSetNodePtr & node) {
					bool ok = true;
					for(uint32_t x : node->cellPositions()) {
						if (pickedCellPositions->count(x)) {
							ok = false;
							break;
						}
					}
					if (ok) {
						currentChildCellPositions->insert(currentChildCellPositions->end(), node->cellPositions().begin(), node->cellPositions().end());
						for(const auto & c : *node) {
							if (!this->operator()(c)) {
								return false;
							}
						}
						return true;
					}
					else {
						return false;
					}
				}
			} calc;
			calc.currentChildCellPositions = &currentChildCellPositions;
			calc.pickedCellPositions = &pickedCellPositions;
			for(uint32_t i(0), s(rPtr->size()); i < s; ++i) {
				currentChildCellPositions.clear();
				bool ok = true;
				uint32_t rPos = count2Pos[i].second;
				const auto & cPtr = rPtr->at(rPos);
				if (overlap) {
					cPtr->visit([&currentChildCellPositions](const SubSetNodePtr::element_type & node) {
						currentChildCellPositions.insert(currentChildCellPositions.end(), node.cellPositions().begin(), node.cellPositions().end());
					});
					uint32_t myOverlappCount = 0;
					for(auto x : currentChildCellPositions) {
						if (pickedCellPositions.count(x)) {
							++myOverlappCount;
						}
					}
					ok = 100*myOverlappCount/cPtr->cellPositions().size() < overlap;
				}
				else {
					ok = calc(cPtr);
				}
				if (ok) {
					pickedCellPositions.insert(currentChildCellPositions.begin(), currentChildCellPositions.end());
					out << delim << gh.ghIdToStoreId(cPtr->ghId());
					delim = ',';
				}
			}
		}
		else {
			for(uint32_t i(0), s(rPtr->size()); i < s; ++i) {
				uint32_t rPos = count2Pos[i].second;
				bool ok = true;
				const auto & cPtr = rPtr->at(rPos);
				const auto & cCp = cPtr->cellPositions();
				if (overlap) {
					uint32_t myOverlappCount = 0;
					for(uint32_t x : cCp) {
						if (pickedCellPositions.count(x)) {
							++myOverlappCount;
						}
					}
					ok = 100*myOverlappCount/cCp.size()< overlap;
				}
				else {
					for(uint32_t x : cCp) {
						if (pickedCellPositions.count(x)) {
							ok = false;
							break;
						}
					}
				}
				if (ok) {
					pickedCellPositions.insert(cCp.begin(), cCp.end());
					out << delim << gh.ghIdToStoreId(cPtr->ghId());
					delim = ',';
				}
			}
		}
		out << "]";
	}
	else {
		out << "[]";
	}

	ttm.end();
	writeLogStats("maximumIndependentChildren", cqs, ttm, cqrSize, 0);
}


void CQRCompleter::dag() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	
	const sserialize::Static::spatial::GeoHierarchy & gh = m_dataPtr->completer->store().geoHierarchy();
	
	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().get("q");
	std::string dagType = request().get("sst");
	std::string regionFilter = request().get("rf");
	
	sserialize::Static::spatial::GeoHierarchy::SubSet subSet;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	
	std::ostream & out = response().out();
	
	writeDag(out, dagType, subSet);
	
	ttm.end();
	writeLogStats("dag", cqs, ttm, subSet.cqr().cellCount(), 0);
}

void CQRCompleter::clusterHints() {
	sserialize::TimeMeasurer ttm;
	ttm.begin();
	
	const sserialize::Static::spatial::GeoHierarchy & gh = m_dataPtr->completer->store().geoHierarchy();
	
	response().set_content_header("text/json");
	
	//params
	std::string cqs = request().post("q");
	std::string regionFilter = request().post("rf");
	
	bool ok;
	std::vector<uint32_t> rqRId( parseJsonArray<uint32_t>(request().post("which"), ok) );
	
	if (!ok) {
		std::ostream & out = response().out();
		out << "Invalid request!";
		return;
	}
	
	sserialize::Static::spatial::GeoHierarchy::SubSet subSet;
	if (m_dataPtr->ghSubSetCreators.count(regionFilter)) {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->ghSubSetCreators.at(regionFilter), m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}
	else {
		subSet = m_dataPtr->completer->clusteredComplete(cqs, m_dataPtr->fullSubSetLimit, m_dataPtr->treedCQR);
	}

	std::unordered_map<uint32_t, std::pair<double, double> > clusterCenters = getClusterCenters(subSet);

	std::ostream & out = response().out();
	out.precision(8);
	
	if (!rqRId.size()) {
		out << "{}";
	}
	else {
		out << '{';
		auto it(rqRId.begin()), end(rqRId.end());
		while (it != end) {
			uint32_t ghId = gh.storeIdToGhId(*it);
			if (clusterCenters.count(ghId)) {
				auto & tmp = clusterCenters.at(ghId);
				out << '"' << *it << "\":[" << tmp.first << ',' << tmp.second << ']';
				++it;
				break;
			}
			else {
				++it;
			}
		}
		for(; it != end; ++it) {
			uint32_t ghId = gh.storeIdToGhId(*it);
			if (clusterCenters.count(ghId)) {
				auto & tmp = clusterCenters.at(ghId);
				out << ",\"" << *it << "\":[" << tmp.first << ',' << tmp.second << ']';
			}
		}
		out << '}';
	}
	ttm.end();
	writeLogStats("clusterHints", cqs, ttm, subSet.cqr().cellCount(), 0);
}


}//end namespace