define(["jquery", "mustache", "tools", "leaflet", "spin","conf", "dag"], function ($, mustache, tools, L, spinner, config) {
	var dag = require("dag");
    var state = {
        map: undefined,
		mapHandler: undefined,
        visualizationActive: false,
        dag: dag.dag(),
        sidebar: undefined,
        handler: undefined,
        loadingtasks: 0,
        cqr: {},
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
			inspectItem: undefined
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
			else if (e.type === "point") {
				t = "Point";
			}
			return { id : e.id, name : e.name, type : t};
		},
        resultListTemplateDataFromItem: function (item, withCloseLink, withDetails) {
            function isMatchedTag(key, value) {
                var testString = key + ":" + value;
                return state.cqrRegExp.test(testString);
            }

            var itemKv = [];
            var wikiLink = undefined;
            var hasMatchingTag = false;
			var itemName = item.name();
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
            if (!itemName.length) {
				if ((street === undefined || houseNumber === undefined)) {
					itemName = "Unnammed item";
				}
				else {
					itemName = undefined;
				}
			}
            
            return {
				"closelink" : withCloseLink,
				"details" : withDetails,
                "itemId": item.id(),
                "score": item.score(),
                "osmId": item.osmid(),
                "osmType": item.type(),
                "itemName": itemName,
                "postcode": postcode,
                "city": city,
                "street": street,
                "housenumber": houseNumber,
                "matchingTagClass": (hasMatchingTag ? "name-has-matched-tag" : false),
                "kv": itemKv //{k,v, link, kc, vc}
            };
        },

        clearViews: function () {
            state.mapHandler.clear();
			state.items.activeItem = undefined;
			state.items.inspectItem = undefined;
            state.dag.clear();
			var dlelem = $("#result_download_link");
			dlelem.attr('data-base-href', "");
			dlelem.attr('href', "");
			$("#empty_result_info").addClass("hidden");
			$("#result_list_container").addClass("hidden");
        },
        
        addSingleQueryStatementToQuery: function (qstr) {
			state.sidebar.open("search");
			$("#sidebar-content").animate({scrollTop: 0});
            var search_text = $('#search_text');
			search_text.val( search_text.val() + " " + qstr);
			search_text.focus();
        },
	   
		setQuery: function(qstr) {
			state.sidebar.open("search");
			$("#sidebar-content").animate({scrollTop: 0});
            var search_text = $('#search_text');
			search_text.val(qstr);
			search_text.focus();
		},
        
    };

    return state;
});
