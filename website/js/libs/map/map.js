define(["require", "state", "jquery", "conf", "oscar", "flickr", "tools", "tree", "bootstrap", "spinner"], function (require, state, $, config, oscar, flickr, tools, tree) {
    spinner = require("spinner");

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
			_domItemHeader: function(itemId) {
				return $("div[class~='panel'][data-item-id~='" + itemId + "'] div[class~='panel-heading']", handler.m_domRoot);
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
	   
			domRoot: function() {
				return handler.m_domRoot;
			},
			
			hasItem: function(itemId) {
				return handler._domItemHeader(itemId).length;
			},
	   
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
			//BUG: this is broken
			scrollTo: function(itemId) {
				if (!hasItem(itemId)) {
					return;
				}
				var domItemHader = handler._domItemHeader();
				var itemPanelRootDiv = $(itemPanelRootId);
				if (itemPanelRootDiv === undefined) {
					console.log("ItemListHandler.scrollTo: undefined itemPanelRootDiv", marker, itemId, shapeSrcType, state);
				}
				else {
					var scrollPos = itemPanelRootDiv.offset().top - container.offset().top + container.scrollTop();
					container.animate({scrollTop: scrollPos});
					//container.animate({scrollTop: itemPanelRootDiv.position().top + $("itemsList").position().top});
				}
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
			appendItems: function(items) {
				for(var i in items) {
					handler.appendItem(items[i]);
				}
			},
			//emits itemDetailsClosed on all open panels   
			clear: function() {
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
				$(handler.m_domRoot).empty();
			},
			//destroy this list by removing the respective dom elements
			//emits itemDetailsClosed on all open panels
			destroy : function() {
				handler.clear();
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
				var tabHeadHtml = '<li id="' + tabHeadId + ' regionId="' + regionId + '"><a href="#' + tabContentId + '">' + regionName + '</a><span class="badge">' + itemCount + '</span></li>';
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
			insertItems: function(regionId, items) {
				if (handler.m_regions.count(regionId)) {
					for(var i in items) {
						handler.m_regions.at(regionId).handler.insert(items[i]);
					}
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
			
			openTab: function(regionId) {
				if (!hasRegion(regionId)) {
					return;
				}
				var index = $("#" + handler.m_regions.at(i).tabHeadId).index();
				handler.m_domRoot.tabs("option", "active", index);
			},
			
			openItem: function(itemId) {
				for(var i in handler.m_regions) {
					if (handler.m_regions.at(i).handler.hasItem(itemId)) {
						openTab(i);
						handler.m_regions.at(i).handler.open(itemId);
						break;
					}
				}
			},
			//return handler of the active tab
			activeTab: function() {
				var index = handler.m_domRoot.tabs("option", "active");
				var li = handler.m_domTabRoot.children().eq(index);
				var regionId = parseInt(li.attr["regionId"]);
				return handler.m_regions.at(regionId).handler;
			},
			
			refresh: function () {
				handler.m_domRoot.tabs("refresh");
				handler.m_domRoot.tabs("option", "active", 0);
			},

			clear: function() {
				for(var i in handler.m_regions.values()) {
					handler.m_regions.at(i).destroy();
				}
			},

			destroy: function () {
				handler.clear();
				handler.m_domRoot.destroy();
			}
		};
		handler._init(parent);
		return handler;
	};
	
	//base class form Leaflet layers which take care of layers of items
	//It triggers event on itself
	//Derived classes need to provide a function _fetchLayer(itemId, call-back)
	var ItemLayerHandler = function(target) {
		this.m_target = target;
		this.m_domRoot = $('#map');
		this.m_layers = tools.SimpleHash(); //maps from LeafletLayer -> {layer: LeafletLayer, refCount: <int> }
		this.m_forwardedSignals = [], //add the name of the signals you want to process here in the form ["layer signal name", "map signal name"]
		this._addSignalHandlers = function(layer) {
			var me = this;
			for(var i in this.m_forwardedSignals) {
				var srcTgtSignal = this.m_forwardedSignals[i];
				layer.on(srcTgtSignal[0], function(e) {
					var e = $.Event(srcTgtSignal[1]);
					e.itemId = e.target.itemId;
					$(me).triggerHandler(e);
				});
			}
		},
		this.domRoot = function() {
			return this.m_domRoot;
		}
		this.count = function() {
			if (this.m_layers.count(itemId)) {
				return this.m_layers.at(itemId).refCount;
			}
			return 0;
		};
		this.incRefCount = function(itemId) {
			if (!this.m_layers.count(itemId)) {
				this.m_layers.insert(itemId, {layer: undefined, refCount : 0});
			}
			this.m_layers.at(itemId).refCount += 1;
		};
		this.setLayer = function(itemId, layer) {
			if (!this.m_layers.count(itemId)) {
				this.incRefCount(itemId);
			}
			if (this.m_layers.at(itemId).layer !== undefined) {
				this.m_target.removeLayer(this.m_layers.at(itemId).layer);
				this.m_layers.at(itemId).layer = undefined;
			}
			if (layer !== undefined) {
				this.m_layers.at(itemId).layer = layer;
				this.m_target.addLayer(this.m_layers.at(itemId).layer);
			}
		};
		this.add = function(itemId) {
			if (this.count(itemId)) {
				this.incRefCount(itemId);
				return;
			}
			this.incRefCount(itemId);
			var me = handler;
			//call super class
			this._fetchLayer(itemId, function(layer) {
				if (me.count(itemId) && me.layer(itemId) === undefined) {
					layer.itemId = itemId;
					me._addSignalHandlers(layer);
					me.setLayer(itemId, layer);
				}
			});
		};
		this.remove = function(itemId) {
			if (this.count(itemId)) {
				this.m_layers.at(itemId).refCount -= 1;
				if (this.m_layers.at(itemId).refCount <= 0) {
					if (this.m_layers.at(itemId).layer !== undefined) {
						this.m_target.removeLayer(this.m_layers.at(itemId).layer);
					}
					this.m_layers.erase(itemId);
				}
			}
		};
		this.layer = function(itemId) {
			if (this.count(itemId)) {
				this.m_layers.at(itemId).layer;
			}
			return undefined;
		};
		this.zoomTo = function(itemId) {
			if (!this.count(itemId)) {
				return;
			}
			var ll = this.layer(itemId);
			this.m_target.fitBounds(ll.getBounds());
		};
		this.destroy = function() {
			for(var i in this.m_layers.values()) {
				if (this.m_layers.at(i).layer !== undefined) {
					this.m_target.removeLayer(this.m_layers.at(i).layer);
				}
			}
			this.m_layers = tools.SimpleHash();
		};
	};
	
	//The ShapeHandler handles the map shapes. It uses ref-counting to track the usage of shapes
	//Style is of the form:
	var ItemShapeHandler = function(target, style) {
		var handler = new ItemLayerHandler(target);
		handler.m_style = style,
		handler.m_forwardedSignals = [["click", "click"]];
		//calls cb after adding if cb !== undefined
		handler._fetchLayer = function(itemId, cb) {
			oscar.getShape(itemId, function(shape) {
				var lfs = oscar.leafletItemFromShape(shape);
				lfs.setStyle(me.m_style);
				cb(lfs);
			}, tools.defErrorCB);
		};
		return handler;
	};
	
	var MarkerHandler = function(target) {
		var handler = new ItemLayerHandler(target);

		///returns leaflet LatLng
		handler.coords = function(itemId) {
			if (!this.count(itemId)) {
				throw new RangeError();
			}
			return this.layer(itemId).getLatLng();
		};
		
		return handler;
	};

	var ItemMarkerHandler = function(target) {
		var handler = MarkerHandler(target);
		handler.m_forwardedSignals = [["click", "click"]];
		handler._fetchLayer = function(itemId, cb) {
			oscar.getShape(itemId, function(shape) {
				var lfs = oscar.leafletItemFromShape(shape);
				if (itemShape instanceof L.MultiPolygon) {
					geopos = itemShape.getLatLngs()[0][0];
				} else if (itemShape instanceof L.Polygon) {
					geopos = itemShape.getLatLngs()[0];
				} else if (itemShape instanceof L.Polyline) {
					geopos = itemShape.getLatLngs()[0];
				} else {
					geopos = itemShape.getLatLng();
				}
				var marker = L.marker(geopos);
				cb(marker);
			}, tools.defErrorCB);
		};
		return handler;
	};
	
	var RegionMarkerHandler = function(target) {
		var handler = MarkerHandler();
		handler.m_forwardedSignals = [["click", "click"], ["mouseout", "mouseout"], ["mouseover", "mouseover"]];
		handler._fetchLayer = function(itemId, cb) {
			if (this.count(itemId)) {
				this.incRefCount(itemId);
				return;
			}
			this.incRefCount(itemId);
			var me = handler;
			oscar.getItem(itemId, function(item) {
				if (!me.count(itemId)) {
					return;
				}
				var marker = L.marker(item.centerPoint());
				marker.name = item.name();
				me.setLayer(itemId, marker);
			}, tools.defErrorCB);
		};
	};
	
	var SpatialQueryGeoObjectHandler = function() {
		var handler = MarkerHandler();
		handler.m_forwardedSignals = [["click", "click"]];
		handler._fetchLayer = function(itemId, cb) {
			//fetched by internal id
			cb( state.spatialObjects.store.at(itemId).mapshape );
		};
	};
	
    return map = {
		ItemListHandler: ItemListHandler,
		RegionItemListTabHandler: RegionItemListTabHandler,
		ItemShapeHandler: ItemShapeHandler,
		ItemMarkerHandler: ItemMarkerHandler,
		RegionMarkerHandler: RegionMarkerHandler,
		
		resultListTabs: undefined,
		relativesTab: { activeItemHandler: undefined, relativesHandler: undefined },
		
		//map shapes
		itemShapes: ItemShapeHandler(state.map, config.styles.shapes.items.normal),
		regionShapes: ItemShapeHandler(state.map, config.styles.shapes.regions.normal),
		relativesShapes: ItemShapeHandler(state.map, config.styles.shapes.relatives.normal),
		highlightItemShapes: ItemShapeHandler(state.map, config.styles.shapes.activeItems),
		
		//markers
		itemMarkers: ItemMarkerHandler(state.map),
		regionMarkers: RegionMarkerHandler(state.map),
		clusterMarkers: undefined,
		
		init: function() {
			map.resultListTabs = map.RegionItemListTabHandler($('#left_menu_parent'));
			map.relativesTab.activeItemHandler = map.ItemListHandler($('#activeItemsList'));
			map.relativesTab.relativesHandler = map.ItemListHandler($('#relativesList'));
			
			//init the cluster markers
            var myClusterMarkerGroup = L.markerClusterGroup();
            myClusterMarkerGroup.on('clusterclick', function (a) {
                a.layer.zoomToBounds();
            });
			state.map.addLayer(myClusterMarkerGroup);
			clusterMarkers.RegionMarkerHandler(myClusterMarkerGroup);
			
			//register slots
			$(map.resultListTabs.domRoot()).on("itemDetailsOpened", map.onItemDetailsOpen);
			$(map.resultListTabs.domRoot()).on("itemDetailsClosed", map.onItemDetailsClosed);
			
			$(map.itemMarkers).on("click", map.onItemMarkerClicked);
			
			$(map.regionMarkers).on("click", map.onRegionMarkerClicked);
			$(map.regionMarkers).on("mouseover", map.onRegionMarkerMouseOver);
			$(map.regionMarkers).on("mouseout", map.onRegionMarkerMouseOut);
		},
		
		displayCqr: function (cqr) {
			state.regionHandler = map.flatCqrTreeDataSource(cqr);
			var process = map.pathProcessor(cqr);
			var root = new tools.TreeNode(0xFFFFFFFF, undefined);
			root.count = cqr.rootRegionApxItemCount();
			root.name = "World";
			state.DAG.insert(0xFFFFFFFF, root);

			if (cqr.ohPath().length) {
				state.regionHandler({rid: 0xFFFFFFFF, draw: false, pathProcessor: process});
			} else {
				state.regionHandler({rid: 0xFFFFFFFF, draw: true, pathProcessor: process});
			}
		},
	   
		//spatial query object handling
	   
		toggleSpatialObjectMapShape: function(internalId) {
			if (state.spatialObjects.store.count(internalId)) {
				var d = state.spatialObjects.store.at(internalId);
				var active = d['active'];
				if (active === undefined || active === false) {
					state.map.addLayer(d.mapshape);
					d['active'] = true;
				}
				else {
					state.map.removeLayer(d.mapshape);
					d['active'] = false;
				}
			}
		},
		removeSpatialObject: function(internalId) {
			if (state.spatialObjects.store.count(internalId)) {
				var d = state.spatialObjects.store.at(internalId);
				if (d.active === true) {
					state.map.removeLayer(d.mapshape);
				}
				state.spatialObjects.names.erase(d.name);
				state.spatialObjects.store.erase(internalId);
			}
		},
		appendSpatialObjectToTable : function(name) {
			var internalId = state.spatialObjects.names.at(name);
			if (internalId === undefined) {
				return;
			}
			var so = state.spatialObjects.store.at(internalId);
			var data = {
				type : so.type,
				id : internalId,
				name : name
			};
			var parentElement = $('#spatial_objects_table_body');
            var templateData = state.spatialQueryTableRowTemplateDataFromSpatialObject(data);
            var rendered = $.Mustache.render('spatialQueryTableRowTemplate', templateData);
            var inserted = $($(rendered).appendTo(parentElement));
			$(".checkbox", inserted).change(function() {
				map.toggleSpatialObjectMapShape(internalId);
			});
			$(".form-control", inserted).change(function() {
				var me = $(this);
				var d = state.spatialObjects.store.at(internalId);
				var oldName = d.name;
				d.name = me.val();
				state.spatialObjects.names.erase(oldName);
				state.spatialObjects.names.insert(d.name, internalId);
			});
			$(".fa-remove", inserted).click(function() {
				inserted.remove();
				map.removeSpatialObject(internalId);
			});
		},
		
		//relatives handling

		//shows the relatives of the currently active item if the relatives pane is active
		showItemRelatives: function() {
			if (!$('#item_relatives').hasClass("active") || state.items.activeItem === undefined) {
				return;
			}
			map.relativesTab.activeItemHandler.clear();
			map.relativesTab.relativesHandler.clear();
			var itemId = state.items.activeItem;
			oscar.getItem(itemId, function(item) {
				if (itemId != state.items.activeItem) {
					return;
				}
				map.relativesTab.activeItemHandler.appendItem(item);
			});
			oscar.getItemsRelativesIds(itemId, function(relativesIds) {
				if (state.items.activeItem != itemId) {
					return;
				}
				var myItemId = itemId;
				oscar.getItems(relativesIds, function(relatives) {
					if (state.items.activeItem != myItemId) {
						return;
					}
					map.relativesTab.relativesHandler.appendItems(relatives);
				}, tools.defErrorCB);
			}, tools.defErrorCB);
		},
		
		//panel event handlers
		onItemDetailsOpen: function(e) {
			var itemId = e.itemId;
			state.items.activeItem = itemId;
			map.highlightItemShapes.add(itemId, function() {
				if (state.items.activeItem == itemId) {
					map.highlightItemShapes.zoomTo(itemId);
				}
			});
			
			//TODO populate geopos here
			L.popup({offset: new L.Point(0, -25)})
				.setLatLng(geopos)
				.setContent($(this).text()).openOn(state.map);

			if ($('#show_flickr').is(':checked')) {
				flickr.getImagesForLocation($.trim($(this).text()), geopos);
			}
		},
		onItemDetailsClosed: function(e) {
			var itemId = e.itemId;
			if (state.items.activeItem === itemId) {
				state.items.activeItem = -1;
			}
			map.highlightItemShapes.remove(itemId);
			//TODO: close flickr bar
		},
	   
		onItemMarkerClicked: function(e) {
			map.resultListTabs.openItem(e.itemId);
			map.resultListTabs.activeTab().scrollTo(e.itemId);
		},
		
		onRegionMarkerClicked: function(e) {
			map.closePopups();
			map.regionMarkers.remove(e.itemId);
			state.regionHandler({rid: e.itemId, draw: true, dynamic: true});
		},
		onRegionMarkerMouseOver: function(e) {
			map.regionShapes.add(e.itemId);
			var coords = map.regionMarkers.coords(e.itemId);
			var marker = map.regionMarkers.layer(e.itemId);
			L.popup({offset: new L.Point(0, -10)})
				.setLatLng(coords)
				.setContent(marker.name).openOn(state.map);
		},
		onRegionMarkerMouseOut: function(e) {
			map.closePopups();
			map.regionShapes.remove(e.target.rid)
		},
		//now for some old stuff, everything below needs refactoring


		flatCqrTreeDataSource: function (cqr) {
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
										node.count = regionChildrenApxItemsMap[itemId];
										node.bbox = item.bbox();
										node.name = item.name();
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
									node.count = regionChildrenApxItemsMap[itemId];
									node.bbox = item.bbox();
									node.name = item.name();
									state.DAG.insert(itemId, node);
								}
								else {
									state.DAG.at(itemId).parents.push(parentNode);
									parentNode.children.push(state.DAG.at(itemId));
								}
							}
						}

						// DAG-modification finished, now decide whether items should be loaded, or clusters be drawn
						if (!items.length || (parentCount <= oscar.maxFetchItems)) {
							if (context.draw || !cqr.ohPath().length || cqr.ohPath()[cqr.ohPath().length - 1] == parentRid) {
								$("#left_menu_parent").css("display", "block");

								if (cqr.ohPath().length) {
									state.cqr.regionItemIds(parentRid,
										map.getItemIds,
										tools.defErrorCB,
										0 // offset
									);
								}
								else {
									if (state.DAG.at(parentRid).children.length == 0) {
										state.cqr.regionItemIds(parentRid,
											map.getItemIds,
											tools.defErrorCB,
											0 // offset
										);
									}
									else {
										for (var child in state.DAG.at(parentRid).children) {
											var id = state.DAG.at(parentRid).children[child].id;
											state.cqr.regionItemIds(id,
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
							var j;
							var regions = [];
							for (var i in items) {
								j = itemMap[items[i].id()];
								if (!map.clusterMarkers.count(j.id())) {
									map.clusterMarkers.add(j.id());
									regions.push(j.id());
								}
							}

							// just load regionShapes into the cache
							oscar.fetchShapes(regions, function() {}, tools.defErrorCB);

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
		},

		getItemIds: function (regionId, itemIds) {
			map.resultListTabs.addRegion(regionId);
			map.resultListTabs.insertItems(itemIds);
			tree.refresh(regionId);
			

			oscar.getItems(itemIds,
				function (items) {
					var node;
					state.items.clusters.drawn.erase(regionId);

					// manage items -> kill old items if there are too many of them and show clusters again
					if (state.items.listview.drawn.size() + items.length > config.maxBufferedItems) {
						for (var i in state.items.listview.drawn.values()) {
							node = state.DAG.at(i);
							for (var parent in node.parents) {
								if (!state.items.clusters.drawn.count(node.parents[parent].id)) {
									state.markers.addLayer(node.parents[parent].marker);
									state.items.clusters.drawn.insert(node.parents[parent].id, node.parents[parent].marker);
								}
							}
							if (node.marker) {
								state.markers.removeLayer(node.marker);
							}
							node.kill();
							delete node;
						}
						$('#itemsList').empty();
						$('#tabs').empty();
						state.items.listview.drawn.clear();
						state.items.shapes.cache.clear();
						state.items.shapes.markers.clear();
					}

					var tabsInitialized = $('#items_parent').data("ui-tabs");
					var tab = "<li><a href='#tab-" + regionId + "'>" + state.DAG.at(regionId).name + "</a><span class='badge'>" + items.length + "</span></li>";
					if (!$("a[href='#tab-" + regionId + "']").length) {
						$('#tabs').append(tab);
					}

					if (!tabsInitialized) {
						$('#items_parent').tabs();
					}

					var regionDiv = "<div id='tab-" + regionId + "'></div>";
					if (!$("#tab-" + regionId).length) {
						$('#itemsList').append(regionDiv);
					}
					var parentElement = $('#tab-' + regionId);
					for (var i in items) {
						var item = items[i];
						var itemId = item.id();
						if (state.items.listview.promised.count(itemId)) {
							if (!state.DAG.count(itemId)) {
								state.DAG.insert(itemId, state.DAG.at(regionId).addChild(itemId));
							} else {
								//TODO: check whether regionId already contains this itemId as child
								state.DAG.at(regionId).children.push(state.DAG.at(itemId));
								state.DAG.at(itemId).parents.push(state.DAG.at(regionId));
							}
							state.DAG.at(itemId).name = item.name();
							map.appendToItemsList(item, parentElement);
							state.items.listview.promised.erase(itemId);
						}
					}
					map.refreshTabs();
					map.visualizeResultListItems();

					if (state.visualizationActive) {
						
					}

				},
				tools.defErrorCB
			);
		},

		loadSubhierarchy: function (rid, finish) {
			state.cqr.regionChildrenInfo(rid, function (regionChildrenInfo) {
				var children = [];
				var regionChildrenApxItemsMap = {};

				for (var i in regionChildrenInfo) {
					var ci = regionChildrenInfo[i];
					regionChildrenApxItemsMap[ci['id']] = ci['apxitems'];
					children.push(ci['id']);
				}

				oscar.getItems(children, function (items) {
						var itemId, item, node, parentNode, marker;
						parentNode = state.DAG.at(rid);

						for (var i in items) {
							item = items[i];
							itemId = item.id();
							if (!state.DAG.count(itemId)) {
								node = parentNode.addChild(itemId);
								marker = L.marker(item.centerPoint());
								node.count = marker.count = regionChildrenApxItemsMap[itemId];
								node.bbox = marker.bbox = item.bbox();
								node.name = marker.name = item.name();
								marker.rid = item.id();
								map.decorateMarker(marker);
								node.marker = marker;
								state.DAG.insert(itemId, node);
								map.addClusterMarker(state.DAG.at(itemId));
							}
						}

						if ($("#onePath").is(':checked')) {
							tree.onePath(parentNode);
						} else {
							tree.refresh(rid);
						}

						finish();
					}, function () {
					}
				);
			}, function(){});
		},
		loadWholeTree: function () {
			function subSetHandler(subSet) {
				state.DAG = tools.SimpleHash();
				var regions = [];
				for (var region in subSet.regions) {
					regions.push(region);
				}

				//fetch the items
				oscar.getItems(regions,
					function (items) {
						var marker;
						for (var i in items) {
							var item = items[i];
							var itemId = item.id();
							var regionInSubSet = subSet.regions[itemId];
							var node = state.DAG.at(itemId);

							if (node) {
								node.name = item.name();
								node.count = regionInSubSet.apxitems;
								node.bbox = item.bbox();
							} else {
								var newNode = new tools.TreeNode(itemId, undefined);
								newNode.count = regionInSubSet.apxitems;
								newNode.name = item.name();
								newNode.bbox = item.bbox();
								state.DAG.insert(itemId, newNode);
								node = newNode;
							}

							for (var child in regionInSubSet.children) {
								node.addChild(regionInSubSet.children[child]);
							}
						}

						var root = state.DAG.at(0xFFFFFFFF);
						for (var j in subSet.rootchildren) {
							root.children.push(state.DAG.at(subSet.rootchildren[j]));
						}
					},
					oscar.defErrorCB
				);
			}

			state.cqr.getDag(subSetHandler, tools.defErrorCB);
		},
		
		loadItems: function (rid) {
			state.cqr.regionItemIds(rid,
				map.getItemIds,
				tools.defErrorCB,
				0 // offset
			);
		},
	   
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
		
		drawClusters: function (node) {
			if (!node) {
				return;
			}

			var childNode;
			if (node.children.length) {
				for (var child in node.children) {
					childNode = node.children[child];
					if (tools.percentOfOverlap(state.map, childNode.bbox) >= config.overlap) {
						map.drawClusters(childNode);
					}
					else {
						if (childNode.count) {
							map.addClusterMarker(childNode);
						}
						else if (!childNode.count) {
							map.addItemMarker(childNode);
							map.addDagItemToResultList(childNode);
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


		
		removeMarker: function (marker) {
			if (marker.shape) {
				state.map.removeLayer(marker.shape);
			}
			state.markers.removeLayer(marker);
			map.closePopups();
		},

		removeClusterMarker: function (node) {
			map.regionMarkers.remove(node.id);
		},

		addClusterMarker: function (node) {
			map.regionMarkers.add(node.id);
		},

		removeItemMarker: function (node) {
			map.removeClusterMarker(node);
		},

		addItemMarker: function (node) {
			map.addClusterMarker(node);
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
						}
						else {
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

							for (var item in currentItemMarkers) {
								drawn.insert(item, false);
							}

							for (var cluster in currentClusterMarker) {
								map.removeClusterMarker(state.DAG.at(cluster));
							}

							if (this.path && this.path.length) {
								// start at the target region (last element of ohPath)
								map.drawClusters(state.DAG.at(this.path[this.path.length - 1]));
							}
							else {
								// start at Node "World"
								map.drawClusters(state.DAG.at(0xFFFFFFFF));
							}

							// remove all markers (and tabs) that are redundant
// 							for (var item in drawn.values()) {
// 								if (drawn.at(item) == false) {
// 									map.removeItemMarker(state.DAG.at(item));
// 									map.removeParentsTabs(state.DAG.at(item));
// 								}
// 							}

							timer.stop();
						}.bind(this);
						state.map.on("zoomend dragend", state.handler);
					}
				}
			};
		}
    };
});