define(["state", "tools", "conf", "oscar", "map"], function(state, tools, config, oscar, map){
    return search = {
       //replace spatial objects with the real deal
	   replaceSpatialObjects: function(qstr) {
			var res = "";
			var withInExact = false;
			for(i=0; i < qstr.length;) {
				if (qstr[i] === '"') {
					withInExact = !withInExact;
					res += '"';
					++i;
				}
				else if (qstr[i] === '\\') {
					++i;
					if (i < qstr.length) {
						res += '\\' + qstr[i];
						++i;
					}
				}
				else if (qstr[i] === '&' && !withInExact) {
					var name = "";
					for(++i; i < qstr.length && qstr[i] !== ' '; ++i) {
						name += qstr[i];
					}
					if (state.spatialObjects.names.count(name)) {
						res += state.spatialObjects.store.at(state.spatialObjects.names.at(name)).query;
					}
				}
				else {
					res += qstr[i];
					++i;
				}
			}
			return res;
	   },
        doCompletion: function () {
            if ($("#search_text").val() === state.queries.lastQuery) {
                return;
            }
            state.clearViews();

            $("#showCategories a").click();
            state.sidebar.open("search");
            $("#flickr").hide("slide", {direction: "right"}, config.styles.slide.speed);

            //query has changed, ddos the server!
            var myQuery = $("#search_text").val();
            
            state.queries.lastQuery = myQuery + "";//make sure state hold a copy

            var ohf = (parseInt($('#ohf_spinner').val()) / 100.0);
            var globalOht = $('#oht_checkbox').is(':checked');
			var regionFilter = jQuery('#region_filter').val();
            //ready for lift-off
            var myQueryCounter = state.queries.lastSubmited + 0;
            state.queries.lastSubmited += 1;

            var callFunc;
			//call sequence starts
			if ($("#full_cqr_checkbox").is(':checked')) {
				callFunc = function(q, scb, ecb) {
					oscar.completeFull(q, scb, ecb);
				};
			}
			else {
				callFunc = function(q, scb, ecb) {
					oscar.completeSimple(q, scb, ecb, ohf, globalOht, regionFilter);  
				};
			}

			var myRealQuery =  search.replaceSpatialObjects(myQuery);
			
            if ($('#searchModi input').is(":checked")) {
                //TODO: wrong placement of markers if clustering is active. Cause: region midpoint is outside of search rectangle
				
				var minLat = Math.max(state.map.getBounds().getSouthWest().lat, -90);
				var maxLat = Math.min(state.map.getBounds().getNorthEast().lat, 90);
				var minLng = Math.max(state.map.getBounds().getSouthWest().lng, -180);
				var maxLng = Math.min(state.map.getBounds().getNorthEast().lng, 180);
				myRealQuery = "(" + myRealQuery + ") $geo:" + minLng + "," + minLat + "," + maxLng + "," + maxLat;
            }

            //push our query as history state
            window.history.pushState({"q": myRealQuery}, undefined, location.pathname + "?q=" + encodeURIComponent(myRealQuery));

            //lift-off
            callFunc(myRealQuery,
                function (cqr) {
                    //orbit reached, iniate coupling with user
                    if (state.queries.lastReturned < myQueryCounter) {
                        state.queries.lastReturned = myQueryCounter + 0;
                        state.queries.activeCqrId = cqr.sequenceId();
                        state.cqr = cqr;
                        state.cqrRegExp = oscar.cqrRexExpFromQuery(cqr.query());
                        map.displayCqr(cqr);
						var dllink = oscar.generateDownloadLink(cqr.query(), cqr.regionFilter());
						var dlelem = $("#result_download_link");
						dlelem.attr('data-base-href', dllink);
						dlelem.attr('href', dllink);
                    }
                },
                function (jqXHR, textStatus, errorThrown) {
                    //BOOM!
                    alert("Failed to retrieve completion results. textstatus=" + textStatus + "; errorThrown=" + errorThrown);
                });
        },
	   
        instantCompletion: function () {
            if (state.timers.query !== undefined) {
                clearTimeout(state.timers.query);
            }
            search.doCompletion();
        },

        delayedCompletion: function () {
            if (state.timers.query !== undefined) {
                clearTimeout(state.timers.query);
            }
            state.timers.query = setTimeout(search.instantCompletion, config.timeouts.query);
        },
		
        queryFromSearchLocation: function () {
            var myQ = tools.getParameterByName("q");
            if (myQ.length) {
				tools.setQuery(myQ);
                search.instantCompletion();
			}
		},
		
		///@response array of suggestions
		tagInfoComplete: function(query, response) {
			query = query.slice(1);
			if (query.length < 3) {
				setTimeout(function() { response([]) }, 0);
				return;
			}
			var settings = {
				type: "GET",
				mimeType: 'text/plain',
				data : {
					"sortname" : "count_all",
					"sortorder" : "desc",
					"page": "1",
					"rp" : "10"
				}
			};
			var idx = query.indexOf(":");
			var key = (idx >= 0 ? query.slice(0, idx) : query);
			var value = (idx >= 0 ? query.slice(idx+1) : "");
			if (value.length) {
				settings.url = "https://taginfo.openstreetmap.org/api/4/key/values";
				settings.data["key"] = key
				settings.data["query"] = value
			}
			else {
				settings.url = "https://taginfo.openstreetmap.org/api/4/tags/popular";
				settings.data["query"] = key;
			}
			settings["success"] = function (plain) {
				var data;
				try {
					data = JSON.parse(plain);
				}
				catch (err) {
					tools.defErrorCB("Parsing Json Failed", err);
					return;
				}
				var result = [];
				if (value.length) {
					for (var suggestion in data.data) {
						result.push("@" + key + ":" + data.data[suggestion].value);
					}
				}
				else {
					for (var suggestion in data.data) {
						result.push("@" + data.data[suggestion].key + ":" + data.data[suggestion].value);
					}
				}
				response( result );
			};
			settings["error"] = function (jqXHR, textStatus, errorThrown) {
				tools.defErrorCB(textStatus, errorThrown);
			}
			jQuery.ajax(settings);
		}
    };
});
