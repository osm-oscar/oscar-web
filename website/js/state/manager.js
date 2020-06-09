define(["jquery", "mustache", "tools", "leaflet", "spin","conf", "dag"], function ($, mustache, tools, L, spinner, config) {
	var dag = require("dag");
    var state = {
        map: undefined,
		mapHandler: undefined,
        visualizationActive: false,
        dag: dag.dag(),
        sidebar: undefined,
        handler: undefined,
        cqr: {},
        cqrRegExp: undefined,
        queries: {
            activeCqrId: -1,
            lastReturned: -1,
            lastSubmited: 0,
            lastQuery: "",
            queryInBound: false
        },
        spinner : {
            widget: new spinner(config.spinnerOpts),
            loadingtasks: 0,
            seqId: 0
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
            type : undefined, //one of rect, poly, path, route
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

        clustering : {
            url: "https://oscar-web.de/oscar",
            openedClustering : '#p-tab',
            kvQueryId : -1,
            kQueryId : -1,
            pQueryId : -1,
            fQueryId : -1,
            kRefinements : tools.SimpleHash(), // keyId : int  -> {name : String, itemCount: int}
            pRefinements : tools.SimpleHash(), // parentId : int -> {name : String, itemCount: int}
            kvRefinements : tools.SimpleHash(), // "{keyId: int, valueId: int}" -> {name: String, itemCount: int}
            fRefinements : tools.SimpleHash(), // keyId : int -> [{valueId: int} -> {name: String, itemCount: int}]
            keyNameMap : tools.SimpleHash(), // keyId : int -> keyName : String
            activeIncludingRefinements: [],
            activeExcludingRefinements: [],
            kvExceptions: tools.SimpleHash(), // "{keyId: int, valueId: int}" -> {name : String, itemCount: int}
            kExceptions: tools.SimpleHash(), // keyId -> {name: String, itemCount: int}
            fExceptions: tools.SimpleHash(), // keyId -> {name: String, itemCount: int}
            kDebugInfo: {},
            pDebugInfo: {},
            kvDebugInfo: {},
            fDebugInfo: {},
            debug: true,
            lastKvQuery: "",
            lastKQuery: "",
            lastPQuery: "",
            lastFQuery: "",
            lastQueryWithoutRefinements: "",
            kvRefinementCount: 10,
            kRefinementCount: 10,
            pRefinementCount: 10,
            fRefinementCount: 10,
            kvHasMore: false,
            kHasMore: false,
            pHasMore: false,
            fHasMore: false,
            facetHasMore: tools.SimpleHash(), // keyId : int -> hasMoreElementsToBeFetched : bool
            facetSizes: tools.SimpleHash(), // keyId: int -> elementsToBeFetched: int
            exceptionProfile: '["wheelchair", "addr", "level", "toilets:wheelchair", "building", "source", "roof"]',
            defaultFacetSize: 10
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
			else if (e.type === "cell") {
				t = "Cell";
			}
			else if (e.type === "route") {
				t = "Route";
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
					itemName = "Item without name";
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
            state.resetLoadingSpinner();
            state.mapHandler.clear();
			state.items.activeItem = undefined;
			state.items.inspectItem = undefined;
            state.dag.clear();
			var dlelem = $("#result_download_link");
			dlelem.attr('data-base-href', "");
			dlelem.attr('href', "");
			$("#empty_result_info").addClass("hidden");
			$("#result_list_container").addClass("hidden");
			$("#kvclustering-list").addClass("hidden");
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
        /**
         * displays the spinner
         */
        displayLoadingSpinner: function () {
            if (state.timers.loadingSpinner !== undefined) {
                clearTimeout(state.timers.loadingSpinner);
                state.timers.loadingSpinner = undefined;
            }
            if (state.spinner.loadingtasks > 0) {
                var target = document.getElementById('loader'); // TODO: use jquery
                state.spinner.widget.spin(target);
            }
        },

        /**
         * start the loading spinner, which displays after a timeout the spinner
         */
        startLoadingSpinner: function () {
            if (state.timers.loadingSpinner === undefined) {
                state.timers.loadingSpinner = setTimeout(state.displayLoadingSpinner, config.timeouts.loadingSpinner);
            }
            state.spinner.loadingtasks += 1;
            return state.spinner.seqId;
        },

        /**
         * ends a spinner instance
         */
        endLoadingSpinner: function (spinnerId) {
            if (spinnerId != state.spinner.seqId) {
                return;
            }
            if (state.spinner.loadingtasks === 1) {
                state.spinner.loadingtasks = 0;
                if (state.timers.loadingSpinner !== undefined) {
                    clearTimeout(state.timers.loadingSpinner);
                    state.timers.loadingSpinner = undefined;
                }
                state.spinner.widget.stop();
            }
            else {
                state.spinner.loadingtasks -= 1;
            }
        },
        resetLoadingSpinner: function() {
            if (state.timers.loadingSpinner !== undefined) {
                clearTimeout(state.timers.loadingSpinner);
                state.timers.loadingSpinner = undefined;
            }
            state.spinner.seqId += 1;
            state.spinner.loadingtasks = 0;
            state.spinner.widget.stop();
        }
    };

    return state;
});
