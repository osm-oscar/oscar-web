#pragma once

#include <cppcms/application.h>
#include <sserialize/stats/TimeMeasuerer.h>

#include "types.h"

namespace oscar_web {

	
class BaseApp: public cppcms::application {
public:
	using InternalRequestId  = uint32_t;
public:
	BaseApp(cppcms::service& srv, CompletionFileDataPtr dataPtr, std::string const & logPrefix);
	~BaseApp() override;
protected:
	//Call this only once per request, this will log appropriate information
	InternalRequestId genIntReqId(std::string const & fn);
	void log(std::string const & what);
	void log(InternalRequestId intReqId, std::string const & fn, std::string const & what);
	void log(InternalRequestId intReqId, std::string const & fn, sserialize::TimeMeasurer const & tm);
	void log(InternalRequestId intReqId, std::string const & fn, sserialize::TimeMeasurer const & tm, sserialize::CellQueryResult const & cqr);
	void log(InternalRequestId intReqId, std::string const & fn, sserialize::TimeMeasurer const & tm, sserialize::CellQueryResult const & cqr, sserialize::ItemIndex const & items);
protected:
	inline CompletionFileDataPtr const & dptr() const { return m_d; }
	inline CompletionFileDataPtr & dptr() { return m_d; }
	inline oscar_web::CompletionFileData const & d() const { return *m_d; }
	inline oscar_web::CompletionFileData & d() { return *m_d; }
private:
	CompletionFileDataPtr m_d;
	std::string m_lp;
};
	
}
