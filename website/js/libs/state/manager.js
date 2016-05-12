define(["jquery", "mustache", "tools", "leaflet", "spin","conf", "leafletCluster", "dag"], function ($, mustache, tools, L, spinner, config) {
	var dag = require("dag");
    var state = {
        map: undefined,
        visualizationActive: false,
        dag: dag.dag(),
        markers: L.markerClusterGroup(),
        sidebar: undefined,
        handler: undefined,
        loadingtasks: 0,
        cqr: {},
        regionHandler: undefined,
        cqrRegExp: undefined,
        queries: {
            activeCqrId: -1,
            lastReturned: -1,
            lastSubmited: 0,
            lastQuery: "",
            queryInBound: false
        },
        timers: {
            spatialquery: undefined,
            query: undefined,
            loadingSpinner: undefined
        },
        spatialObjects : {
			store : tools.SimpleHash(), //internalId -> {mapshape : Leaflet.Shape, query : String, active : boolean}
			names : tools.SimpleHash() // String -> internalId
		},
        spatialquery : {
            active : false,
            mapshape : undefined,
            type : undefined, //one of rect, poly, path
            coords : [],
            selectButtonState : 'select'
        },
        domcache: {
            searchResultsCounter: undefined
        },
        shownBoundaries: [],
		items : {
			activeItem: undefined,
		},
		//e = {type : type, id : internalId, name : name}
		spatialQueryTableRowTemplateDataFromSpatialObject: function(e) {
			var t = "invalid";
			if (e.type === "rect") {
				t = "Rectangle";
			}
			else if (e.type === "poly") {
				t = "Polygon";
			}
			else if (e.type === "path") {
				t = "Path";
			}
			return { id : e.id, name : e.name, type : t};
		},
        resultListTemplateDataFromItem: function (item) {
            function isMatchedTag(key, value) {
                var testString = key + ":" + value;
                return state.cqrRegExp.test(testString);
            }

            var itemKv = [];
            var wikiLink = undefined;
            var hasMatchingTag = false;
            var postcode, street, city, houseNumber;

            for (var i = 0; i < item.size(); ++i) {
                var itemKey = item.key(i);
                var itemValue = item.value(i);
                var entry = {"k" : itemKey, "v" : itemValue}

                switch (itemKey) {
                    case "addr:city":
                        city = itemValue;
                        break;
                    case "addr:postcode":
                        postcode = itemValue;
                        break;
                    case "addr:street":
                        street = itemValue;
                        break;
                    case "addr:housenumber":
                        houseNumber = itemValue;
                        break;
                }
                if (isMatchedTag(itemKey, itemValue)) {
                    entry["kc"] = "matched-key-color";
                    entry["vc"] = "matched-value-color";
                    hasMatchingTag = true;
                }
                if (config.resultsview.urltags[itemKey] !== undefined) {
                    entry["link"] = config.resultsview.urltags[itemKey](itemValue);
                }
                itemKv.push(entry);
            }
            return {
                "itemId": item.id(),
                "score": item.score(),
                "osmId": item.osmid(),
                "osmType": item.type(),
                "itemName": item.name(),
                "postcode": postcode,
                "city": city,
                "street": street,
                "housenumber": houseNumber,
                "matchingTagClass": (hasMatchingTag ? "name-has-matched-tag" : false),
                "kv": itemKv //{k,v, link, kc, vc}
            };
        },

        clearViews: function () {
            if (state.handler !== undefined) {
                state.map.off("zoomend dragend", state.handler);
            }
			state.items.activeItem = undefined;
            state.dag.clear();
        },
        initMarkers: function(){
            state.markers = L.markerClusterGroup();
            state.markers.on('clusterclick', function (a) {
                a.layer.zoomToBounds();
            });
        }
    };

    return state;
});
