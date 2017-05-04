requirejs.config({
    baseUrl: "",
    config: {
        'oscar': {
// 			url: "http://localoscar/oscar",
			url: "http://oscardev.fmi.uni-stuttgart.de/oscar",
			//thw following variables have to match the ones in your server config (or should be smaller)
			maxFetchItems: 2000,
			maxFetchShapes: 2000,
			maxFetchIdx: 1000
		}
    },
    paths: {
        "jquery": "vendor/jquery/jquery.min",
        "jqueryui": "vendor/jquery-ui/jquery-ui.min",
        "bootstrap": "vendor/twitter-bootstrap/js/bootstrap.min",
		"typeahead" : "vendor/typeahead/typeahead.jquery",
		"bloodhound" : "vendor/typeahead/bloodhound",
        "leaflet": "vendor/leaflet/leaflet-src",
        "leafletCluster": "vendor/leaflet-markercluster/leaflet.markercluster-src",
		"awesomeMarkers" : "vendor/leaflet-awesome-markers/leaflet.awesome-markers.min",
        "sidebar": "vendor/leaflet-sidebar/js/leaflet-sidebar",
        "spin": "vendor/spin/spin.min",
        "mustache": "vendor/mustache/mustache.min",
        "mustacheLoader": "vendor/mustache/jquery.mustache.loader",
        "slimbox": "vendor/slimbox/js/slimbox2",
        "switch": "vendor/switch-button/jquery.switchButton",
        "flickr": "vendor/flickr/flickr",
        "d3": "vendor/dagre-d3/d3.min",
        "dagre-d3": "vendor/dagre-d3/dagre-d3.min",
        "jdataview": "vendor/jdataview/jdataview",
        "jbinary": "vendor/jbinary/jbinary",
		//and now our own stuff
        "spinner": "js/spinner/spinner",
        "sserialize": "js/sserialize/sserialize",
        "oscar": "js/oscar/oscar",
        "tools": "js/tools/tools",
        "conf": "js/config/config",
        "manager": "js/connection/manager.min",
        "tree": "js/tree/tree",
        "map": "js/map/map",
        "state": "js/state/manager",
        "query": "js/query/query",
        "search": "js/search/search",
		"dag": "js/dag/dag",
		"dagexp" : "js/dag/dagexp"
    },
    shim: {
        'bootstrap': {deps: ['jquery']},
        'leafletCluster': {deps: ['leaflet', 'jquery']},
        'awesomeMarkers': {deps: ['leaflet', 'jquery']},
        'sidebar': {deps: ['leaflet', 'jquery']},
        'mustacheLoader': {deps: ['jquery']},
        'slimbox': {deps: ['jquery']},
    },
    waitSeconds: 20
});

requirejs(["leaflet", "jquery", "mustache", "jqueryui", "sidebar", "mustacheLoader", "conf",  "switch", "state", "map", "tree", "query", "tools", "search"],
    function () {
        var L = require("leaflet");
		var jQuery = require("jquery");
		var mustache = require("mustache");
		var jqueryui = require("jqueryui");
		var sidebar = require("sidebar");
		var mustacheLoader = require("mustacheLoader");
		var config = require("conf");
		var switchButton = require("switch");
		var state = require("state");
		var map = require("map");
		var tree = require("tree");
        var query = require("query");
		var tools = require("tools");
        var search = require("search");
		
		//set the map handler
		state.mapHandler = map;

        // mustache-template-loader needs this
        window.Mustache = mustache;

        // load template files
        $.Mustache.load('template/arrayItemListEntryTemplate.mst');
        $.Mustache.load('template/spatialQueryTableRowTemplate.mst');
        $.Mustache.load('template/treeTemplate.mst');
        $("#sidebar-pane-help").load('template/help.html', function () {
            $('.example-query-string').on('click', function () {
				state.setQuery(this.firstChild.data);
            });
        });

        $(document).ready(function () {
            $("#tree").resizable();

            $('[data-toggle="tooltip"]').tooltip();

            var search_form = $("#search_form");
            search_form.click(function () {
                if (!$('#categories').is(":visible")) {
                    $("#showCategories a").click();
                }
            });
            $(search_form[0].children).css("width", "100%");
            search_form.bind('submit', function (e) {
                e.preventDefault();
                search.instantCompletion();
            });
			
			search.bindTagCompletion('#search_text');
			
            $('#graph').click(function () {
                $("#onePath").button().change(function() {
					//we need to redraw the whole graph if the former state was onePath
					if (state.dag.hasRegion(0xFFFFFFFF) && ! $(this).is(":checked") ) {
						tree.visualizeDAG(state.dag.region(0xFFFFFFFF));
					}
				});
                $("#wholeTree").button().click(function () {
                    map.loadWholeTree();
					if (state.dag.hasRegion(0xFFFFFFFF)) {
						tree.visualizeDAG(state.dag.region(0xFFFFFFFF));
					}
                });
                if (state.dag.hasRegion(0xFFFFFFFF)) {
                    tree.visualizeDAG(state.dag.region(0xFFFFFFFF));
                }
            });

            $('#closeTree a').click(function () {
                state.visualizationActive = false;
                $('#tree').css("display", "none");
            });

            $('#closeFlickr a').click(function () {
                $("#flickr").hide("slide", {direction: "right"}, config.styles.slide.speed);
            });

            $("#searchModi input").switchButton({
                on_label: 'Local',
                off_label: 'Global'
            });

            $('#show_tree').click(function () {
                $('#results_tree_parent').toggle();
            });

            $('#show_flickr').click(function () {
                var flickr = $("#flickr");
                if (!$(this).is(':checked')) {
                    flickr.hide();
                } else {
                    flickr.show();
                }
            });
			
			$('#display_cluster_shapes_checkbox').click(function() {
				var enabled = $(this).is(':checked');
				map.cfg.clusterShapes.auto = false;
				map.cfg.clusterShapes.preload = enabled;
				map.cfg.clusterShapes.display = enabled;
				map.reloadShapeConfig();
			});
			
			$('#display_item_shapes_checkbox').click(function() {
				var enabled = $(this).is(':checked');
				map.cfg.resultList.showItemShapes = enabled;
				map.mapViewChanged();
			});
			
			$('#display_item_markers_checkbox').click(function() {
				var enabled = $(this).is(':checked');
				map.cfg.resultList.showItemMarkers = enabled;
				map.mapViewChanged();
			});
			
// 			state.sidebar.on('tab-closed', function(e) {});
// 			state.sidebar.on('tab-opened', function(e) {});

            $('#spatialquery_selectbutton').click(function() {
                if (state.spatialquery.selectButtonState === 'select') {
                    query.startSpatialQuery();
                }
                else if (state.spatialquery.selectButtonState === 'finish') {
                    query.endSpatialQuery();
                }
                else if (state.spatialquery.selectButtonState === 'clear') {
                    query.clearSpatialQuery();
                }
            });
			
            $('#spatialquery_acceptbutton').click(function() {
                if (state.spatialquery.type === undefined) {
                    return;
                }
                query.endSpatialQuery();
                var qStr = ""
                if (state.spatialquery.type === "rect") {
                    var minLat = Math.min(state.spatialquery.coords[0].lat, state.spatialquery.coords[1].lat);
                    var maxLat = Math.max(state.spatialquery.coords[0].lat, state.spatialquery.coords[1].lat);
                    var minLng = Math.min(state.spatialquery.coords[0].lng, state.spatialquery.coords[1].lng);
                    var maxLng = Math.max(state.spatialquery.coords[0].lng, state.spatialquery.coords[1].lng);
					//now clip
					var minLat = Math.max(minLat, -90);
					var maxLat = Math.min(maxLat, 90);
					var minLng = Math.max(minLng, -180);
					var maxLng = Math.min(maxLng, 180);
                    qStr = "$geo:" + minLng + "," + minLat + "," + maxLng + "," + maxLat;
                }
                else if (state.spatialquery.type === "path") {
                    if (state.spatialquery.coords.length > 0) {
                        qStr = "$path:" + jQuery('#spatialquery_radius').val();
                        for(i in state.spatialquery.coords) {
                            qStr += "," + state.spatialquery.coords[i].lat + "," + state.spatialquery.coords[i].lng;
                        }
                    }
                }
                else if (state.spatialquery.type === "point") {
                    if (state.spatialquery.coords.length > 0) {
                        qStr = "$point:" + jQuery('#spatialquery_radius').val();
						qStr += "," + state.spatialquery.coords[0].lat + "," + state.spatialquery.coords[0].lng;
                    }
                }
                else if (state.spatialquery.type === "poly") {
                    if (state.spatialquery.coords.length > 3) {
                        qStr = "$poly";
                        var delim = ":"
                        for(i in state.spatialquery.coords) {
                            qStr += delim + state.spatialquery.coords[i].lat + "," + state.spatialquery.coords[i].lng;
                            delim = ",";
                        }
                    }
                }
                if (qStr.length) {
					var id;
					for(i=0; true; ++i) {
						if (!state.spatialObjects.store.count(i)) {
							id = i;
							break;
						}
					}
					var data = {
						name : id,
						type : state.spatialquery.type,
						mapshape : state.spatialquery.mapshape,
						query : qStr
					};
					state.spatialObjects.store.insert(id, data);
					state.spatialObjects.names.insert(id, id);
					map.appendSpatialObjectToTable(id);
                }
                query.clearSpatialQuery();
            });
			
            $('#spatialquery_type').change(function(e) {
                if (e.target.value !== state.spatialquery.type) {
                    query.clearSpatialQuery();
                }
                if (e.target.value === 'path' || e.target.value === 'point') {
                    $('#spatialquery_radius_group').removeClass('hidden');
                }
                else {
                    $('#spatialquery_radius_group').addClass('hidden');
                }
            });
			
			$('#result_download_select').change(function(e) {
				var dlelem = $("#result_download_link");
				if (e.target.value === "items") {
					dlelem.attr("href", dlelem.attr("data-base-href"));
				}
				else if (e.target.value === "items+parents") {
					dlelem.attr("href", dlelem.attr("data-base-href")+"&p=true");
				}
				else if (e.target.value === "items+shapes") {
					dlelem.attr("href", dlelem.attr("data-base-href")+"&s=true");
				}
				else if (e.target.value === "items+parents+shapes") {
					dlelem.attr("href", dlelem.attr("data-base-href")+"&p=true&s=true");
				}
			});

            $(window).bind('popstate', function (e) {
				console.log(e);
//                 search.queryFromSearchLocation();
            });

            //check if there's a query in our location string
            search.queryFromSearchLocation();
			
			//store some config options
			
			state.sidebar.open("search");
        });
    });
