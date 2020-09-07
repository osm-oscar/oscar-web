#include "Routing.h"
#include "BinaryWriter.h"
#include "helpers.h"
#include <cppcms/http_request.h>
#include <cppcms/http_response.h>
#include <cppcms/json.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>
#include <cppcms/util.h>
#include <path_finder/graphs/Graph.h>
#include <path_finder/helper/base64.h>

namespace oscar_web {

Routing::Routing(cppcms::service &srv, const CompletionFileDataPtr &dataPtr)
    : BaseApp(srv, dataPtr, "Routing") {
  dispatcher().assign("/route", &Routing::route, this);
  mapper().assign("route", "/route");
}

Routing::~Routing() {}

void Routing::route() {
  auto irId = genIntReqId("route");

  sserialize::TimeMeasurer ttm;
  ttm.begin();
  auto data = d();
  std::vector<sserialize::spatial::GeoPoint> waypoints;
  int flags = liboscar::interface::CQRFromRouting::F_CAR;
  std::ostream &out = response().out();


  // params
  bool ok = true;
  std::string errmsg;
  {
    std::stringstream ss;
    ss << request().get("q");
    cppcms::json::value qj;
    ok = qj.load(ss, true);
    if (ok && qj.type() == cppcms::json::is_array) {
      auto qja = qj.array();
      for (auto const &x : qja) {
        if (x.type() == cppcms::json::is_array) {
          cppcms::json::array tmp = x.array();

          if (tmp.size() == 2) {
            try {
              double lat = tmp.at(0).get_value<double>();
              double lon = tmp.at(1).get_value<double>();
              waypoints.emplace_back(lat, lon,
                                     sserialize::spatial::GeoPoint::NT_WRAP);
            } catch (const cppcms::json::bad_value_cast &err) {
              ok = false;
            }
          } else {
            ok = false;
          }
        } else {
          ok = false;
        }
        if (!ok) {
          break;
        }
      }
    }

    if (!ok) {
      errmsg = "Syntax error in query variable q";
    }
  }
  {
    std::string t = request().get("t");
    if ("car" == t) {
      flags = liboscar::interface::CQRFromRouting::F_CAR;
    } else if ("bike" == t) {
      flags = liboscar::interface::CQRFromRouting::F_BIKE;
    } else if ("foot" == t) {
      flags = liboscar::interface::CQRFromRouting::F_PEDESTRIAN;
    }
  }

  if (!ok) {
    response().status(response().bad_request, errmsg);
  } else {
    pathFinder::RoutingResult completeRoutingResult;
    for(int i = 1; i < waypoints.size(); ++i) {
      auto routingResult =
          data.hybridPathFinder->getShortestPath(pathFinder::LatLng{(float)(waypoints[i-1].lat()), (float)(waypoints[i-1].lon())},
                                                 pathFinder::LatLng{(float)(waypoints[i].lat()), (float)(waypoints[i].lon())});
      completeRoutingResult += routingResult;
    }
    response().set_content_header("text/json");
    bool first = true;
    out << "{\"path\":[";

    for (auto wp : completeRoutingResult.path) {
      if (!first) {
        out << ',';
      }
      out << '[' << wp.lat << ',' << wp.lng << ']';
      first = false;
    }
    out << "]";
    out << ",\"distance\": " << completeRoutingResult.distance;
    out << ",\"distanceTime\": " << completeRoutingResult.routingResultTimingInfo.distanceTime;
    out << ",\"pathTime\": " << completeRoutingResult.routingResultTimingInfo.pathTime;
    out << ",\"cellTime\": " << completeRoutingResult.routingResultTimingInfo.cellTime;
    out << ",\"nodeSearchTime\": " << completeRoutingResult.routingResultTimingInfo.nodeSearchTime;
  }
  out << "}";
  ttm.end();
  log(irId, "route", ttm);
}

} // end namespace oscar_web
