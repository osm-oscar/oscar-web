define(["state", "tools", "conf", "oscar", "map", "fuzzysort"], function(state, tools, config, oscar, map, fuzzysort){
	var encompletion = {
		"base": [
		{
				"poi": "SpecialPhrasesNotLoadedYet",
				"tag_key": "waterway",
				"tag_value": "waterfall"
		}
	]
	}
	encompletion.base.forEach(t => t.poiPrepared = fuzzysort.prepare(t.poi))
	
	var data = {
		specialphrases: encompletion,
	}
	var search = {
		data : data,
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
			var spinnerId = state.startLoadingSpinner();
            callFunc(myRealQuery,
                function (cqr) {
					state.endLoadingSpinner(spinnerId);
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
						search.updateDownloadLink();
                    }
                },
                function (jqXHR, textStatus, errorThrown) {
					state.endLoadingSpinner(spinnerId);
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
				state.setQuery(myQ);
                search.instantCompletion();
			}
		},
	   
		updateDownloadLink: function() {
			var dlelem = $("#result_download_link");
			var content = $("#result_download_select")
			var format = $("#result_download_format");
			var params = ""
			var content_selection = content.val();
			var format_selection = format.val();
			if (content_selection === "items") {
				params += "&i=true";
			}
			if (content_selection === "parents") {
				params += "&i=false&p=true";
			}
			else if (content_selection === "items+parents") {
				params += "&i=true&p=true";
			}
			else if (content_selection === "items+shapes") {
				params += "&i=true&s=true";
			}
			else if (content_selection === "parents+shapes") {
				params += "&i=false&p=true&s=true";
			}
			else if (content_selection === "items+parents+shapes") {
				params += "&i=true&p=true&s=true";
			}
			
			if (format_selection === "geojson") {
				params += "&format=geojson";
			}
			
			dlelem.attr("href", dlelem.attr("data-base-href") + params);
		},
		
		bindTagCompletion: function(element) {
            var search_text = $(element);
            search_text.autocomplete({
					source: function(request, response) {
						//request is the whole string
						//but we only need the part around the current cursor position
						
						var caret = search_text[0].selectionStart;
						var term = request.term;
						var begin = caret;
						var end = caret;
						
						//begin should start at the end of the token
						if (begin === term.length || term[begin] === ' ' || term[begin] === '(' || term[begin] === ')') {
							--begin;
						}
						else {
							setTimeout(function() {response([]); }, 0);
							return;
						}
						
						for(; begin >= 0; --begin) {
							var c = term[begin];
							//we're done
							if (term[begin] === '@') {
								break;
							}
							else if (term[begin] === ' ' || term[begin] === '(' || term[begin] === ')') {
								//check for  escape before delimeter
								if (begin > 0) {
									if (term[begin-1] === '\\') {
										begin -= 1;
										continue;
									}
								}
								begin = -1;
								break;
							}
						}
						//begin now either points to the position of the @ or it is -1
						if (begin < 0) {
							setTimeout(function() { response([])}, 0);
							return;
						}
						
						//end may point to the beginning of an escape sequence
						if (term[end] === '\\') {
							++end;
						}
						
						//check for end
						for(; end < term.length; ++end) {
							if (term[end] === '\\') {
								//skip next character
								++end;
							}
							else if (term[end] === ' ' || term[end] === '(' || term[end] === ')') {
								break;
							}
						}
						//end now either points to the position of the first non-tag character or to the end of the request
						var tag = term.slice(begin, end);
						var metadata = { begin: begin, end: end, caret: caret};
						search.tagInfoComplete(tag, function(result) {
								//result is an array
								let myResult  = [];
								let myResultTags = new Set();
								let fuzzy_results = fuzzysort.go(tag.slice(1, -1), data.specialphrases.base, config.completion.fuzzysort.options);
								for(let x of fuzzy_results) {
									let myTag = x.obj.tag_key + ":" + x.obj.tag_value
									if (!myResultTags.has(myTag)) {
										myResult.push({label: x.obj.poi + " -> " + myTag, value: "@" + myTag, metadata: metadata});
										myResultTags.add(myTag)
									}
								}

								for(let x of result) {
									if (!myResultTags.has(x)) {
										myResult.push({label: x, value: "@" + x, metadata: metadata});
										myResultTags.add(x)
									}
								}
								//state.lang
								response(myResult);
							}
						);
					},
					select: function(evt, obj) {
						var selection = obj.item.value;
						var metadata = obj.item.metadata;
						var caret = metadata.begin + selection.length;
						var text = search_text.val();
						search_text.val( text.slice(0, metadata.begin) + selection + text.slice(metadata.end, text.length) );
						search_text.focus();
						search_text[0].setSelectionRange(caret, caret);
						return false;
					},
					focus: function(evt, obj) {
						return false;
					},
					delay: 200
			});
		},
		
		///@response array of suggestions
		tagInfoComplete: function(query, response) {
			if (query.length < 3 || query[0] != '@') {
				setTimeout(function() { response([]) }, 0);
				return;
			}
			query = query.slice(1);
			var settings = {
				type: "GET",
				mimeType: 'text/plain',
				data : {
					"sortname" : "count_all",
					"sortorder" : "desc",
					"page": "1",
					"rp" : "10"
				},
				timeout : 2000
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
						result.push(key + ":" + data.data[suggestion].value);
					}
				}
				else {
					for (var suggestion in data.data) {
						result.push(data.data[suggestion].key + ":" + data.data[suggestion].value);
					}
				}
				response( result );
			};
			settings["error"] = function (jqXHR, textStatus, errorThrown) {
				response([])
				// tools.defErrorCB(textStatus, errorThrown);
			}
			jQuery.ajax(settings);
		}
    };

	var languageName = window.navigator.userLanguage || window.navigator.language;
	languageName = languageName.substr(0, 2);
	
	var retrieve_specialphrases = function (lang, successCB, errorCB) {
		jQuery.ajax({
			type: "GET",
			url: "data/tag-completion/" + lang + ".json",
			mimeType: "application/json",
			success: function (jsondesc) {
				successCB(jsondesc)
			},
			error: function (jqXHR, textStatus, errorThrown) {
				errorCB(textStatus, errorThrown);
			}
		});
	};

	var parse_specialphrases = function(jsondesc) {
		search.data.specialphrases = jsondesc;
		search.data.specialphrases.base.forEach(t => t.poiPrepared = fuzzysort.prepare(t.poi))
	}

	retrieve_specialphrases(languageName, parse_specialphrases, 
		function(textStatus, errorThrown) {
			retrieve_specialphrases("en", parse_specialphrases, defErrorCB)
		}
	);

	return search;
});
