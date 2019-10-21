#include "BaseApp.h"
#include <cppcms/http_request.h>

namespace oscar_web {
	
BaseApp::BaseApp(cppcms::service& srv, CompletionFileDataPtr dataPtr, std::string const & logPrefix) :
cppcms::application(srv),
m_d(dataPtr),
m_lp(logPrefix)
{}

BaseApp::~BaseApp() {}

BaseApp::InternalRequestId
BaseApp::genIntReqId(std::string const & fn) {
	//maybe we should derive this from the request, though this should do for now
	InternalRequestId id = ::random();
	std::stringstream ss;
	ss << "request=";
	char sep = '{';
	for(auto const & x : request().post_or_get()) {
		ss << sep << '"' << x.first << "\":\"" << x.second << '"';
		sep = ',';
	}
	ss << '}';
	log(id, fn, ss.str());
	return id;
}

void
BaseApp::log(std::string const & what) {
	*(m_d->log) << what << std::endl;
}

void
BaseApp::log(InternalRequestId intReqId, std::string const & fn, std::string const & what) {
	std::stringstream ss;
	ss << m_lp << "::" << fn << " t=" << std::chrono::system_clock::now().time_since_epoch().count() << "s, id=" << intReqId << ", what=" << what;
	log(ss.str());
}

void
BaseApp::log(InternalRequestId intReqId, std::string const & fn, sserialize::TimeMeasurer const & tm) {
	std::stringstream ss;
	ss << m_lp << "::" << fn << " t=" << std::chrono::system_clock::now().time_since_epoch().count() << "s, id=" << intReqId;
	log(ss.str());
}

void
BaseApp::log(InternalRequestId intReqId, std::string const & fn, sserialize::TimeMeasurer const & tm, sserialize::CellQueryResult const & cqr) {
	std::stringstream ss;
	ss << m_lp << "::" << fn << " t=" << std::chrono::system_clock::now().time_since_epoch().count() << "s, id=" << intReqId << ", rs=" << cqr.cellCount();
	log(ss.str());
}

void
BaseApp::log(InternalRequestId intReqId, std::string const & fn, sserialize::TimeMeasurer const & tm, sserialize::CellQueryResult const & cqr, sserialize::ItemIndex const & items) {
	std::stringstream ss;
	ss << m_lp << "::" << fn << " t=" << std::chrono::system_clock::now().time_since_epoch().count() << "s, id=" << intReqId << ", rs=" << cqr.cellCount() << ", is=" << items.size();
	log(ss.str());
}
	
}//end namespace oscar_web
