define(["state", "oscar", "tools", "conf", "map", "leafletCluster"], function (state, oscar, tools, config, map) {
    /**
     * Extend MarkerCluster:
     * 1) show names of subregions of a cluster in a popup
     * 2) show region boundaries of sub-clusters either by merging them on-the-fly or
     *    showing all sub-regions
     */
    L.MarkerCluster.prototype.on("mouseover", function (e) {
        if (e.target.getChildCount() > 1 && e.target.getChildCount() <= config.maxNumSubClusters && map.cfg.clusterShapes.display) {
			var childRids = e.target.getChildClustersRegionIds();
			oscar.fetchShapes(childRids, function() {}, tools.defErrorCB);
			for(var i in childRids) {
				map.clusterMarkerRegionShapes.add(childRids[i]);
			}
		}
        var names = e.target.getChildClustersNames();
        var text = "";
        if (names.length > 0) {
            for (var i in names) {
                if(i > config.maxNumSubClusters){
                    text += "...";
                    break;
                }
                text += names[i];
                if (i < names.length - 1) {
                    text += ", ";
                }
            }
            L.popup({offset: new L.Point(0, -10)}).setLatLng(e.latlng).setContent(text).openOn(state.map);
        }
    });

    /**
     * Extend Markercluster: close popups and remove region-boundaries of sub-clusters
     */
    L.MarkerCluster.prototype.on("mouseout", function (e) {
		map.clusterMarkerRegionShapes.clear();
        map.closePopups();
    });

    /**
     * Remove displayed region boundaries when the mouse is over a cluster-marker & the user zooms-in
     * TODO: Shouldn't this be handled by the MarkerCluster since removing it should trigger a mouseout?
     * Not yet, since the MarkerCluster is a special marker that does not interface with map.js yet
     * It is created by the MarkerCluster library
     */
    var old = L.FeatureGroup.prototype.removeLayer;
    L.FeatureGroup.prototype.removeLayer = function (e) {
        map.clusterMarkerRegionShapes.clear();
        old.call(this, e);
    };

});
