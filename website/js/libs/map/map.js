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
								} else {
									state.DAG.at(itemId).parents.push(parentNode);
									parentNode.children.push(state.DAG.at(itemId));
								}
							}
						}
					} else if (parentCount > oscar.maxFetchItems) {
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
							} else {
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
							} else {
								if (state.DAG.at(parentRid).children.length == 0) {
									state.items.listview.selectedRegionId = parentRid;
									state.cqr.regionItemIds(state.items.listview.selectedRegionId,
										map.getItemIds,
										tools.defErrorCB,
										0 // offset
									);
								} else {
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
					} else if (context.draw) {
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
						oscar.getShapes(regions, function (res) {
						}, tools.defErrorCB);

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

	var pathProcessor = function (cqr) {
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
				} else {
					// fit the viewport to the target region
					if (this.path.length) {
						state.map.fitBounds(state.DAG.at(this.path[this.path.length - 1]).bbox);
					} else {
						state.map.fitWorld();
					}
					state.handler = function () {
						var timer = tools.timer("draw");
						var drawn = tools.SimpleHash();
						var removedParents = tools.SimpleHash();
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
						} else {
							// start at Node "World"
							map.drawClusters(state.DAG.at(0xFFFFFFFF), drawn, bulkMarkerBuffer);
						}

						state.markers.addLayers(bulkMarkerBuffer);

						// remove all markers (and tabs) that are redundant
						for (var item in drawn.values()) {
							if (drawn.at(item) == false) {
								map.removeItemMarker(state.DAG.at(item));
								map.removeParentsTabs(state.DAG.at(item), removedParents);
							}
						}

						timer.stop();
					}.bind(this);
					state.map.on("zoomend dragend", state.handler);
				}
			}
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
			}
	   
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
				return $("div[class~='panel'][data-item-id~='" + itemId + "'] div[class~='panel-collapse'][data-item-id~='"+ itemId +"']");
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
			destroy : function() {
				$(handler.m_domRoot).remove();
			}
		};
		handler.init(parent);
		return handler;
	};
	
	//handles item lists of multiple regions as tab groups
	var RegionItemListTabHandler = function(parent) {
		var handler = {
			m_domRoot : undefined,
			m_domTabRoot : undefined,
			m_regions : tools.SimpleHash(), //maps from regionId=<int> -> ItemListHandler
			
			_init: function (parent) {
				handler.m_domRoot = $(parent).append("</div>");
				handler.m_domTabRoot = $(parent).append("</ul>");
				handler.m_domRoot.tabs();
			},
			//adds a new region, returns an ItemListHandler
			add: function(regionId) {
				if (handler.m_regions.count(regionId)) {
					return handler.m_regions.at(regionId);
				}
				//add a new tab
				
			},
			//removes a tab
			remove: function(regionId) {
				if (handler.m_regions.count(regionId)) {
					handler.m_regions.at(regionId).destroy();
					handler.m_regions.erase(regionId);
				}
			},
			
			refresh: function () {
				handler.m_domRoot.tabs("refresh");
				handler.m_domRoot.tabs("option", "active", 0);
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
		pathProcessor : pathProcessor,
		ItemListHandler: ItemListHandler,
		TabbedItemListHandler : TabbedItemListHandler
    };
});