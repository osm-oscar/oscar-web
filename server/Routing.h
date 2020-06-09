#ifndef OSCAR_WEB_ROUTING_H
#define OSCAR_WEB_ROUTING_H

#include "BaseApp.h"

namespace oscar_web {

/**
  *This is the main query completer.
  */

class Routing: public BaseApp {
public:
	Routing(cppcms::service& srv, const CompletionFileDataPtr & dataPtr);
	virtual ~Routing();
	/** Returns the full path of the requested query
	  * q=[[lat, lon]] the list of points be visited in that order
	  * t=car|bike|foot
	  * Return:
	  * One array of [lat,lon] pairs per sub-query
	  * [ [ [lat,lon] ] ]
	  */
	void route();
};



}//end namespace

#endif
