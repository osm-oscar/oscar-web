define(["require", "state", "jquery", "conf", "oscar", "flickr", "tools", "tree", "bootstrap", "spinner"], function (require, state, $, config, oscar, flickr, tools, tree) {
    spinner = require("spinner");

	//and now some classes
	
	var flatCqrTreeDataSource = function (cqr) {
		function getItems(regionChildrenInfo, context) {
			var regionChildrenApxItemsMap = {};
			var childIds = [];
			var parentRid = context.rid;
			var parentNode = state.DAG.at(parentRid);
			var parentCount = parentNode.count;

			for (var i in regionChildrenInfo) {
				var ci = regionChildrenInfo[i];
				regionChildrenApxItemsMap[ci['id']] = ci['apxitems'];
				childIds.push(ci['id']);
			}

			oscar.getItems(childIds,
				function (items) {
					var itemMap = {}, node, item, itemId, marker;

					// modify DAG
					if (!context.dynamic) {
						for (var i in items) {
							item = items[i];
							itemId = item.id();
							itemMap[itemId] = item;
							if (!cqr.ohPath().length || ($.inArray(itemId, cqr.ohPath()) != -1 || (parentRid == cqr.ohPath()[cqr.ohPath().length - 1] && parentCount > oscar.maxFetchItems))) {
								if (!state.DAG.count(itemId)) {
									node = parentNode.addChild(itemId);
									marker = L.marker(item.centerPoint());
									node.count = marker.count = regionChildrenApxItemsMap[itemId];
									node.bbox = marker.bbox = item.bbox();
									node.name = marker.name = item.name();
									marker.rid = itemId;
									map.decorateMarker(marker);
									node.marker = marker;
									state.DAG.insert(itemId, node);
								}
								else {
									state.DAG.at(itemId).parents.push(parentNode);
									parentNode.children.push(state.DAG.at(itemId));
								}
							}
						}
					}
					else if (parentCount > oscar.maxFetchItems) {
						for (var i in items) {
							item = items[i];
							itemId = item.id();
							itemMap[itemId] = item;
							if (!state.DAG.count(itemId)) {
								node = parentNode.addChild(itemId);
								marker = L.marker(item.centerPoint());
								node.count = marker.count = regionChildrenApxItemsMap[itemId];
								node.bbox = marker.bbox = item.bbox();
								node.name = marker.name = item.name();
								marker.rid = itemId;
								map.decorateMarker(marker);
								node.marker = marker;
								state.DAG.insert(itemId, node);
							}
							else {
								state.DAG.at(itemId).parents.push(parentNode);
								parentNode.children.push(state.DAG.at(itemId));
							}
						}
					}

					// DAG-modification finished, now dicide whether items should be loaded, or clusters be drawn
					if (!items.length || (parentCount <= oscar.maxFetchItems)) {
						if (context.draw || !cqr.ohPath().length || cqr.ohPath()[cqr.ohPath().length - 1] == parentRid) {
							$("#left_menu_parent").css("display", "block");

							if (cqr.ohPath().length) {
								state.items.listview.selectedRegionId = parentRid;
								state.cqr.regionItemIds(state.items.listview.selectedRegionId,
									map.getItemIds,
									tools.defErrorCB,
									0 // offset
								);
							}
							else {
								if (state.DAG.at(parentRid).children.length == 0) {
									state.items.listview.selectedRegionId = parentRid;
									state.cqr.regionItemIds(state.items.listview.selectedRegionId,
										map.getItemIds,
										tools.defErrorCB,
										0 // offset
									);
								}
								else {
									for (var child in state.DAG.at(parentRid).children) {
										state.items.listview.selectedRegionId = state.DAG.at(parentRid).children[child].id;
										state.cqr.regionItemIds(state.items.listview.selectedRegionId,
											map.getItemIds,
											tools.defErrorCB,
											0 // offset
										);
									}
								}
							}
						}
					}
					else if (context.draw) {
						state.items.clusters.drawn.erase(parentRid);

						var j;
						var regions = [];
						for (var i in items) {
							j = itemMap[items[i].id()];

							if (!state.items.clusters.drawn.count(j.id())) {
								regions.push(j.id());
								marker = state.DAG.at(j.id()).marker;
								state.items.clusters.drawn.insert(j.id(), marker);
								state.markers.addLayer(marker);
								state.DAG.at(marker.rid).marker = marker;
							}
						}

						// just load regionShapes into the cache
						oscar.getShapes(regions, function (res) {}, tools.defErrorCB);

						if (state.visualizationActive) {
							tree.refresh(parentRid);
						}
					}

					if (context.pathProcessor) {
						context.pathProcessor.process();
					}

				},
				tools.defErrorCB
			);
		}

		return function (context) {
			spinner.startLoadingSpinner();
			cqr.regionChildrenInfo(context.rid, function (regionChildrenInfo) {
					spinner.endLoadingSpinner()
					getItems(regionChildrenInfo, context);
				},
				tools.defErrorCB
			);
		};
	};

	//handles a single item list
	//parent is the parent element of the Item list the handler should take care of
	//It adds a panel div with class panel-group as parent for the list
	//This triggers itemDetailsOpened and itemDetailsClosed with the respective itemId on the parent element
	var ItemListHandler = function(parent) {
		
		var handler = {
			m_domRoot : undefined,
			//signals emited on the root dom-element
	   
			emit_itemDetailsOpened: function(itemId) {
				$(handler.m_domRoot).trigger({type:"itemDetailsClosed", itemId : itemId});
			},
			emit_itemDetailsClosed: function(itemId) {
				$(handler.m_domRoot).trigger({type:"itemDetailsClosed", itemId : itemId});
			},
			emit_itemLinkClicked: function(itemId) {
				$(handler.m_domRoot).trigger({type:"itemLinkClicked", itemId : itemId});
			},
	   
			//private functions
	   
			_init: function(parent) {
				var myMarkup = '</div class="panel-group">';
				handler.m_domRoot = $(parent).append(myMarkup);
			},
	   
			_addKeyValueQuery: function(element) {
				function itemIdQuery(e) {
					var me = $(this);
					var myItemId = me.attr('data-item-id');
					if (myItemId === undefined) {
						return false;
					}
					var myQstr = "$item:" + myItemId;
					tools.addSingleQueryStatementToQuery(myQstr);
					return false;
				};

				function itemDetailQuery(e) {
					var me = $(this);
					var myKey = me.attr('data-query-key');
					if (myKey === undefined) {
						return false;
					}
					var myQstr = "@" + myKey;
					var myValue = me.attr('data-query-value');
					if (myValue !== undefined) {
						myQstr += ":" + myValue;
					}
					tools.addSingleQueryStatementToQuery(myQstr);
					return false;
				};

				$(".item-detail-key", element).click(itemDetailQuery);
				$(".item-detail-value", element).click(itemDetailQuery);
				$(".item-detail-id", element).click(itemIdQuery);
			},
			_domItemDetails: function(itemId) {
				return $("div[class~='panel'][data-item-id~='" + itemId + "'] div[class~='panel-collapse'][data-item-id~='"+ itemId +"']", handler.m_domRoot);
			},
			
			//internal slots
			_slot_itemLinkClicked: function(itemId) {
				handler.toggle(itemId);
				handler.emit_itemLinkClicked(itemId);
			},

			//public functions
	   
			domRoot: function() { return handler.m_domRoot; }
	   
			open: function(itemId) {
				var details = handler._domItemDetails(itemId);
				details.each(function() {
					var me = $(this);
					if (me.hasClass("collapse") ) {
						me.removeClass("collapse");
						me.addClass("in");
						handler.emit_itemDetailsClosed(itemId);
					}
				});
			},
			//
			close: function(itemId) {
				var details = handler._domItemDetails(itemId);
				details.each(function() {
					var me = $(this);
					if (me.hasClass("in")) {
						me.removeClass("in");
						me.addClass("collapse");
						handler.emit_itemDetailsClosed(itemId);
					}
				});
			},
			//toggle collapse-state of an item
			toggle: function(itemId) {
				var details = handler._domItemDetails(itemId);
				details.each(function() {
					var me = $(this);
					if (me.hasClass("collapse")) {
						me.removeClass("collapse");
						me.addClass("in");
						handler.emit_itemDetailsOpened(itemId);
					}
					else {
						me.removeClass("in");
						me.addClass("collapse");
						handler.emit_itemDetailsClosed(itemId);
					}
				});
			},
			//returns jquery object of the inserted dom item element
			appendItem: function(item) {
				var itemTemplateData = state.resultListTemplateDataFromItem(item);
				var rendered = $.Mustache.render('itemListEntryHtmlTemplate', itemTemplateData);
				var inserted = $($(rendered).appendTo(m_domRoot));
				_addKeyValueQuery(inserted);
				$("a[class~='accordion-toggle']", inserted).on("click", function(e) {
					var me = $(this);
					var itemIdStr = me.attr("data-item-id");
					var itemId = parseInt(itemIdStr);
					handler._slot_itemLinkClicked(itemId);
				});
			},
			//destroy this list by removing the respective dom elements
			//emits itemDetailsClosed on all open panels
			destroy : function() {
				$("div[class~='panel'] div[class~='panel-collapse']", handler.m_domRoot).each(function() {
					var me = $(this);
					var itemIdStr = me.attr("data-item-id");
					var itemId = parseInt(itemIdStr);
					if (me.hasClass("in")) {
						me.removeClass("in");
						me.addClass("collapse");
						handler.emit_itemDetailsClosed(itemId);
					}
				});
				$(handler.m_domRoot).remove();
			}
		};
		handler._init(parent);
		return handler;
	};
	
	//handles item lists of multiple regions as tab groups
	//emits multiple signals on it domRoot:
	var RegionItemListTabHandler = function(parent) {
		var handler = {
			m_domRoot : undefined,
			m_domTabRoot : undefined,
			m_regions : tools.SimpleHash(), //maps from regionId=<int> -> { handler : ItemListHandler, tabContentId: <string>, tabHeadId: <string>}
			
			//signals
			emit_itemDetailsOpened: function(itemId) {
				$(handler.m_domRoot).trigger({type:"itemDetailsClosed", itemId : itemId});
			},
			emit_itemDetailsClosed: function(itemId) {
				$(handler.m_domRoot).trigger({type:"itemDetailsClosed", itemId : itemId});
			},
			emit_itemLinkClicked: function(itemId) {
				$(handler.m_domRoot).trigger({type:"itemLinkClicked", itemId : itemId});
			},
			
			_init: function (parent) {
				handler.m_domRoot = $(parent).append("</div>");
				handler.m_domTabRoot = $(handler.m_domRoot).append("</ul>");
				handler.m_domRoot.tabs();
			},
			
			domRoot: function() {
				return handler.m_domRoot;
			},
			hasRegion: function(regionId) {
				return handler.m_regions.count(regionId);
			},
			//adds a new region, returns an ItemListHandler
			addRegion: function(regionId, regionName, itemCount) {
				var regionId = region.id();
				if (handler.m_regions.count(regionId)) {
					return handler.m_regions.at(regionId).handler;
				}
				//add a new tab
				var tabHeadId = tools.generateDocumentUniqueId();
				var tabContentId = tools.generateDocumentUniqueId();
				var tabHeadHtml = '<li id="' + tabHeadId '"><a href="#' + tabContentId + '">' + regionName + '</a><span class="badge">' + itemCount + "</span></li>';
				var tabContentHtml = '<div id="' + tabContentId + '"></div>';
				var tabHead = $(handler.m_domTabRoot).append(tabHeadHtml);
				var tabContent = $(handler.m_domRoot).append(tabContentHtml);
				var itemListHandler = ItemListHandler(tabContent);
				m_regions.insert(regionId, {
					handler : itemListHandler,
					tabHeadId : tabHeadId,
					tabContentId : tabContentId
				});
				//take care of the signals emited from the list handler
				$(itemListHandler.domRoot()).on("itemDetailsOpened", function(e) { handler.emit_itemDetailsOpened(e.itemId); });
				$(itemListHandler.domRoot()).on("itemDetailsClosed", function(e) { handler.emit_itemDetailsClosed(e.itemId); });
				$(itemListHandler.domRoot()).on("itemLinkClicked", function(e) { handler.emit_itemLinkClicked(e.itemId); });
				handler.refresh();
				return handler.m_regions.at(regionId).handler;
			},
			insertItem: function(regionId, item) {
				if (handler.m_regions.count(regionId)) {
					handler.m_regions.at(regionId).handler.insert(item);
				}
			},
			//removes a region (and it's tab), return true, if removal was successfull
			remove: function(regionId) {
				if (handler.m_regions.count(regionId)) {
					var v = handler.m_regions.at(regionId);
					v.handler.destroy();
					$("#" + v.tabHeadId ).remove();
					$("#" + v.tabContentId ).remove();
					handler.m_regions.erase(regionId);
					handler.refresh();
					return true;
				}
				return false;
			},
			
			refresh: function () {
				handler.m_domRoot.tabs("refresh");
// 				handler.m_domRoot.tabs("option", "active", 0);
			},

			destroy: function () {
				for(var i in handler.m_regions.values()) {
					handler.m_regions.at(i).destroy();
				}
				handler.m_domRoot.destroy();
			}
		};
		return handler;
	};
	
    return map = {
		flatCqrTreeDataSource : flatCqrTreeDataSource,
		ItemListHandler: ItemListHandler,
		TabbedItemListHandler : TabbedItemListHandler,
		
		resultListTabs: undefined,
		
		init: function() {
			map.resultListTabs = map.TabbedItemListHandler($('#left_menu_parent'));
		}
		
		//now form some old stuff, everything below needs refactoring
		
		addDagItemToResultList: function (node) {
			for (var parent in node.parents) {
				var parentNode = node.parents[parent];
				map.resultListTabs.addRegion(parentNode.id, state.DAG.at(parentNode.id), parentNode.count);
				//insert
				oscar.getItem(node.id, function (item) {
					map.resultListTabs.insertItem(parentNode.id, item);
				}, tools.defErrorCB);
			}
		},
		
		drawClusters: function (node, drawn, markerBuffer) {
			if (!node) {
				return;
			}

			var childNode;
			if (node.children.length) {
				for (var child in node.children) {
					childNode = node.children[child];
					if (tools.percentOfOverlap(state.map, childNode.bbox) >= config.overlap) {
						map.drawClusters(childNode, drawn, markerBuffer);
					}
					else {
						if (childNode.count) {
							map.addClusterMarker(childNode);
						}
						else if (!childNode.count) {
							if (!drawn.count(childNode.id)) {
								map.addItemMarker(childNode);
								map.addDagItemToResultList(childNode);
							}
							else {
								drawn.insert(childNode.id, true);
							}
						}
					}
				}
			}
			else if (node.count) {
				state.regionHandler({rid: node.id, draw: true, dynamic: true});
			}
		},
	   
		closePopups: function () {
			var closeElement = $(".leaflet-popup-close-button")[0];
			if (closeElement !== undefined) {
				closeElement.click();
			}
		},

		removeBoundaries: function () {
			for (var boundary in state.shownBoundaries) {
				state.map.removeLayer(state.shownBoundaries[boundary]);
			}
			state.shownBoundaries = [];
		},

		decorateMarker: function (marker) {
			marker.on("click", function (e) {
				map.closePopups();
				state.items.clusters.drawn.erase(e.target.rid);
				map.removeMarker(e.target);
				state.regionHandler({rid: e.target.rid, draw: true, dynamic: true});
			});

			marker.on("mouseover", function (e) {
				if (oscar.isShapeInCache(e.target.rid)) {
					oscar.getShape(e.target.rid, function (shape) {
						var leafletItem = oscar.leafletItemFromShape(shape);
						leafletItem.setStyle(config.styles.shapes['regions']['normal']);
						e.target.shape = leafletItem;
						state.map.addLayer(leafletItem);
					}, tools.defErrorCB);
				}

				L.popup({offset: new L.Point(0, -10)})
					.setLatLng(e.latlng)
					.setContent(e.target.name).openOn(state.map);
			});

			marker.on("mouseout", function (e) {
				map.closePopups();
				if (e.target.shape) {
					state.map.removeLayer(e.target.shape);
				}
			});
		},
		
		removeMarker: function (marker) {
			if (marker.shape) {
				state.map.removeLayer(marker.shape);
			}
			state.markers.removeLayer(marker);
			map.closePopups();
		},

		removeClusterMarker: function (node) {
			map.removeMarker(node.marker);
			state.items.clusters.drawn.erase(node.id);
			map.removeBoundaries();
		},

		addClusterMarker: function (node, buffer) {
			state.items.clusters.drawn.insert(node.id, node.marker);
			if (buffer) {
				buffer.push(node.marker)
			} else {
				state.markers.addLayer(node.marker);
			}
		},

		removeItemMarker: function (node) {
			state.markers.removeLayer(node.marker);
			state.items.shapes.markers.erase(node.id);
			//BUG:this function should NOT erase stuff from the result list. this is a breach of encapuslation
// 			state.items.listview.drawn.erase(node.id);
		},

		addItemMarker: function (node, buffer) {
			state.items.shapes.markers.insert(node.id, node.shape);
			if (buffer) {
				buffer.push(node.marker);
			}
			else if (node.marker) {
				state.markers.addLayer(node.marker);
			}
		},

		removeParentsTabs: function (childNode) {
			for (var parent in childNode.parents) {
				resultListTabs.remove(childNode.parents[parent].id);
			}
		},
		
		pathProcessor: function (cqr) {
			return {
				path: cqr.ohPath(),
				i: 0,
				process: function () {
					var draw;
					if (this.i < this.path.length) {
						if (this.i != this.path.length - 1) {
							draw = false;
						} else {
							draw = true;
						}
						this.i++;
						state.regionHandler({rid: this.path[this.i - 1], draw: draw, pathProcessor: this});
					}
					else {
						// fit the viewport to the target region
						if (this.path.length) {
							state.map.fitBounds(state.DAG.at(this.path[this.path.length - 1]).bbox);
						}
						else {
							state.map.fitWorld();
						}
						state.handler = function () {
							var timer = tools.timer("draw");
							var drawn = tools.SimpleHash();
							var currentItemMarkers = state.items.shapes.markers.values();
							var currentClusterMarker = state.items.clusters.drawn.values();
							var bulkMarkerBuffer = [];

							for (var item in currentItemMarkers) {
								drawn.insert(item, false);
							}

							for (var cluster in currentClusterMarker) {
								map.removeClusterMarker(state.DAG.at(cluster));
							}

							if (this.path && this.path.length) {
								// start at the target region (last element of ohPath)
								map.drawClusters(state.DAG.at(this.path[this.path.length - 1]), drawn, bulkMarkerBuffer);
							}
							else {
								// start at Node "World"
								map.drawClusters(state.DAG.at(0xFFFFFFFF), drawn, bulkMarkerBuffer);
							}

							state.markers.addLayers(bulkMarkerBuffer);

							// remove all markers (and tabs) that are redundant
							for (var item in drawn.values()) {
								if (drawn.at(item) == false) {
									map.removeItemMarker(state.DAG.at(item));
									map.removeParentsTabs(state.DAG.at(item));
								}
							}

							timer.stop();
						}.bind(this);
						state.map.on("zoomend dragend", state.handler);
					}
				}
			};
		},
    };
});