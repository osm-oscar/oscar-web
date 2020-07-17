#include "Routing.h"
#include "BinaryWriter.h"
#include "helpers.h"
#include <cppcms/http_request.h>
#include <cppcms/http_response.h>
#include <cppcms/json.h>
#include <cppcms/url_dispatcher.h>
#include <cppcms/url_mapper.h>
#include <cppcms/util.h>
#include <path_finder/base64.h>

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
    auto routingResult =
        data.m_pathFinder->getShortestPath(pathFinder::LatLng{(float)(waypoints[0].lat()), (float)(waypoints[0].lon())},
                                           pathFinder::LatLng{(float)(waypoints[1].lat()), (float)(waypoints[1].lon())});
    response().set_content_header("text/json");
    bool first = true;
    out << "{\"path\":[";
    sserialize::ItemIndex itemIndex(routingResult.cellIds);



    for (auto wp : routingResult.path) {
      if (!first) {
        out << ',';
      }
      out << '[' << wp.lat << ',' << wp.lng << ']';
      first = false;
    }
    out << "]";
    out << ",\"distance\": " << routingResult.distance;

    out << R"(,"itemsBinary": ")";
    auto cellInfo = sserialize::Static::spatial::GeoHierarchyCellInfo::makeRc(data.completer->store().geoHierarchy());
    sserialize::CellQueryResult cqr(itemIndex, cellInfo, data.completer->indexStore(), sserialize::CellQueryResult::FF_DEFAULTS);

    sserialize::ItemIndex idx = cqr.flaten(d().treedCQRThreads);
    //now write the data
    std::stringstream binaryString;
    BinaryWriter bw(binaryString);
    int count = 0;
    for(auto i(idx.begin()), s(idx.end()); i != s; ++i) {
      bw.putU32(*i);
      auto p = data.completer->store().geoShape(*i).first();
      bw.putU32(p.intLat());
      bw.putU32(p.intLon());
      ++count;
    }
    out << pathFinder::base64_encode(std::string_view(binaryString.str()));
    out << '\"';
    out << ",\"itemCount\":" << count;
    out << "}";
  }
  ttm.end();
  log(irId, "route", ttm);
}

} // end namespace oscar_web
