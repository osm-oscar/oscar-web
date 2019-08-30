define([], function() {
    var protoRegExp = /^.*:\/\//;
    var uriParsers = {
            "id" : function(x) {
                    return x;
            },
            "http" : function(x) {
                    return (protoRegExp.test(x) ? x : "http://" + x);
            },
            "wikipedia" : function(x) {
                    if (protoRegExp.test(x)) {
                            return x;
                    }
                    else {
                            return "https://en.wikipedia.org/wiki/" + x;
                    }
            },
            "wikicommons" : function(x) {
                    if (protoRegExp.test(x)) {
                            return x;
                    }
                    else {
                            return "https://en.wikipedia.org/wiki/commons:" + x;
                    }
            }
    };
    var cfg = {
        styles: { //entries as in leaflet path options
            shapes: {
                regions: {
                    normal: {color: 'yellow', stroke: true, fill: false, opacity: 0.8},
//                     highlight: {color: '#a100ff', stroke: true, fill: true, opacity: 1.0, fillOpacity: 0.8}, //use this for hsl interpolated choropleth map
                    highlight: {color: 'yellow', stroke: true, fill: true, opacity: 1.0, fillOpacity: 0.8},
                    choropleth: {stroke: true, fill: true, opacity: 0.8, fillOpacity: 0.5}
                },
                items: {
                    normal: {color: 'blue', stroke: true, fill: false, opacity: 0.8},
					inspected: {color: '#5cb85c', stroke: true, fill: false, opacity: 1.0},
                    highlight: {color: 'red', stroke: true, fill: false, opacity: 1.0}
                },
                relatives: {
                    normal: {color: 'green', stroke: true, fill: false, opacity: 0.7},
                    highlight: {color: 'green', stroke: true, fill: false, opacity: 1.0}
                },
                activeItems: {
                    normal: {color: 'red', stroke: true, fill: false, opacity: 0.8},
                    highlight: {color: 'red', stroke: true, fill: false, opacity: 1.0}
                },
                geoquery: {
                    normal: {color: '#00BFFF', stroke: true, fill: true, opacity: 0.5},
                    highlight: {color: '#00BFFF', stroke: true, fill: true, opacity: 1.0}
                },
                pathquery: {
                    normal: {color: '#00BFFF', stroke: true, fill: false, opacity: 0.5},
                    highlight: {color: '#00BFFF', stroke: true, fill: false, opacity: 1.0}
                },
                pointquery: {
                    normal: {color: '#00BFFF', stroke: true, fill: false, opacity: 0.5},
                    highlight: {color: '#00BFFF', stroke: true, fill: false, opacity: 1.0}
                },
                cellquery: {
                    normal: {color: '#00BFFF', stroke: true, fill: false, opacity: 0.5},
                    highlight: {color: '#00BFFF', stroke: true, fill: false, opacity: 1.0}
                },
                polyquery: {
                    normal: {color: '#00BFFF', stroke: true, fill: false, opacity: 0.5},
                    highlight: {color: '#00BFFF', stroke: true, fill: false, opacity: 1.0}
                }
            },
			markers: { //maps from tag to marker type
				color : {
					standard : "darkblue",
					inspected : "green",
					relatives: "blue",
					highlighted: "orange"
				},
				icons : {
					"amenity" : {
						"pharmacy" : "medkit",
						"hospital" : "hospital-o",
						"doctors" : "user-md",
						"fast_food" : "cutlery",
						"restaurant" : "cutlery",
						"post_box" : "envelope-o",
						"post_office" : "envelope-o",
						"waste_basket" : "trash-o",
						"recycling" : "recycle",
						"atm" : "credit-card",
						"university" : "university",
						"pub" : "beer",
						"cafe" : "coffee",
						"bar" : "glass",
						"bus_station" : "bus",
						"airport" : "plane",
						"port" : "ship"
					},
					"tourism" : {
						"information" : "info-circle",
						"hotel" : "bed",
	// 					"attraction" : "",
						"viewpoint" : "eye",
						"picnic_site" : "apple",
	// 					"guest_house" : "",
	// 					"camp_site" : "",
	// 					"museum" : ""
					},
					"aeroway" : {
						"aerodrome" : "plane"
					},
					"shop" : {
						"convenience" : "shopping-cart",
						"supermarket" : "shopping-cart"
					}
				}
			},
            menu: {
                fadeopacity: 0.9
            },
            slide: {
                speed: 2000
            }
        },
        resultsview : {
            urltags : {
                "url" : uriParsers["http"],
                "website" : uriParsers["http"],
                "link" : uriParsers["http"],
                "contact:website" : uriParsers["http"],
                "wikipedia" : uriParsers["wikipedia"],
                "wikimedia_commons" : uriParsers["wikicommons"],
                "image" : uriParsers["wikicommons"]
            }
        },
        geoquery: {
            samplecount: 10
        },
        timeouts: {
            query: 0,
            loadingSpinner: 1000,
            spatialquery : {
                select : 10000
            }
        },
		clusters: {
			bboxOverlap: 0.4, // threshold for overlap of a bbox with viewport
			shapeOverlap: 0.1, // threshold for overlap of a bbox with viewport if the shape is within the viewport
			pad: 1 //increase viewport by this amount to compute the regions that should be drawn
		},
		//map options
		map : {
			//call map.reloadShapeConfig() after changing stuff
			clusterShapes: {
				auto: true,
				display: true,
				preload: true,
				threshold: 25, //maximum # root children to display shapes
				choropleth: {
					display: true,
					type: "density", // possible values are "count", "density", "disabled"
					color: {
						"density": function(count, area, baseParams) {
							//density based
							//we assume that the total totalCount is distributed evenly on maxArea
							//areas with this density should have a value of 50%
							let baseDensity = baseParams.totalCount/baseParams.totalArea;
							let ourDensity = count/area;
	// 						let percent = 0.5*Math.min(2, Math.log2(ourDensity) / Math.log2(baseDensity));
							let percent = 0.5*Math.min(2, Math.sqrt(ourDensity/baseDensity));
	// 						let percent = 0.5*Math.min(2, ourDensity / baseDensity);
							return "rgb(" + (percent*255) + ", 0, " + ((1-percent)*255) + ")";
						},
						"count": function(count, area, baseParams) {
								let percent = Math.log2(count) / Math.log2(baseParams.maxCount);
								return "rgb(" + (percent*255) + ", 0, " + ((1-percent)*255) + ")";
						}
					}
				}
			},
			resultList: {
				itemsPerPage: 20,
				bulkItemFetchCount: 100,
				focusMaxOverlapTab: false,
				showItemShapes: false,
				showItemMarkers: true,
				regionTabs: false
			},
			relativesList: {
				showShapes: false
			},
			clustering : {
				//minimum number of items in root node to have a clustered view
				threshold: 100,
				maxZoomLevel: 17,
				clusterMarkerOptions: {
					maxClusterRadius: 90, //A cluster will cover at most this many pixels from its center
					iconCreateFunction: function (cluster) {
						/* https://github.com/Leaflet/Leaflet.markercluster/issues/351
							required to use the preclustering by the server */
						var count = 0;
						if (cluster.count) { // custom call
							count = cluster.count;
						}
						else if (cluster.getAllChildMarkers) {
							var children = cluster.getAllChildMarkers();
							for (let child of children) {
								if (child.count) {
									count += child.count;
								}
							}
						}

						// only true for real items
						var childMarkers = cluster.getAllChildMarkers();
						if (childMarkers.length == 1 && !childMarkers[0].bbox) {
							return new L.Icon.Default();
						}

						var c = 'marker-cluster-';
						var size;

						if (count < 100) {
							c += 'small';
							size = 30 + count/100.0 * 20;
						}
						else if (count < 1000) {
							c += 'medium';
							size = 50 + count/1000.0 * 20;
						}
						else {
							c += 'large';
							size = Math.min(90, 70 + count/10000.0);
						}
						return new L.DivIcon({
							html: '<div><span>' + count + '</span></div>',
							className: 'marker-cluster ' + c,
							iconSize: new L.Point(size, size)
						})
					},
					showCoverageOnHover: false,
					singleMarkerMode: true
				}
			},
			apikeys: {
				//api keys are public anyway. This should at least help against stupid github crawlers
				bing : window.atob("QWs4dVRnOWtYaHpZT0Q3d1BLbGVZaXI4ZG5fVDlHcVJDRmxUYTBhWEVkZUpOZFh1RWVweUl0endo\nNEdEa004dg==\n")
			}
		},
		maxBufferedItems: 350, // buffered locations
		maxNumSubClusters: 10,
		spinnerOpts: {
			lines: 13 // The number of lines to draw
			, length: 5 // The length of each line
			, width: 10 // The line thickness
			, radius: 10 // The radius of the inner circle
			, scale: 1 // Scales overall size of the spinner
			, corners: 1 // Corner roundness (0..1)
			, color: '#000' // #rgb or #rrggbb or array of colors
			, opacity: 0.25 // Opacity of the lines
			, rotate: 0 // The rotation offset
			, direction: 1 // 1: clockwise, -1: counterclockwise
			, speed: 1 // Rounds per second
			, trail: 60 // Afterglow percentage
			, fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
			, zIndex: 2e9 // The z-index (defaults to 2000000000)
			, className: 'spinner' // The CSS class to assign to the spinner
			, top: '50%' // Top position relative to parent
			, left: '50%' // Left position relative to parent
			, shadow: false // Whether to render a shadow
			, hwaccel: false // Whether to use hardware acceleration
			, position: 'absolute' // Element positioning
		},
		
		completion: {
			fuzzysort: {
				options: {
					limit: 5,
					allowTypo: true,
					threshold: -1000,
					key : "poi"
				}
			}
		},

		//functions
		loadFromURI: function() {
			
		},
		storeToURI: function() {
			
		}
	}
    return cfg;
});
