//This module handles most stuff associated with the map-gui. It HAS to be a singleton!
define(["require", "state", "jquery", "conf", "oscar", "flickr", "tools", "tree", "bootstrap", "spinner", "leaflet"],
function (require, state, $, config, oscar, flickr, tools, tree) {
    var spinner = require("spinner");
	var L = require("leaflet");

	//handles a single item list
	//parent is the parent element of the Item list the handler should take care of
	//It adds a panel div with class panel-group as parent for the list
	//This triggers itemDetailsOpened and itemDetailsClosed with the respective itemId on the parent element
	var ItemListHandler = function(parent, scrollContainer) {
		if (scrollContainer === undefined) {
			scrollContainer = parent;
		}
		var handler = {
			m_domRoot : undefined,
			m_scrollContainer: scrollContainer,
			//signals emited on the root dom-element
	   
			emit_itemDetailsOpened: function(itemId) {
				$(handler).triggerHandler({type:"itemDetailsOpened", itemId : itemId});
			},
			emit_itemDetailsClosed: function(itemId) {
				$(handler).triggerHandler({type:"itemDetailsClosed", itemId : itemId});
			},
			emit_itemLinkClicked: function(itemId) {
				$(handler).triggerHandler({type:"itemLinkClicked", itemId : itemId});
			},
	   
			//private functions
	   
			_init: function(parent) {
				var myId = tools.generateDocumentUniqueId();
				var myMarkup = '<div class="panel-group" id="' + myId + '"></div>';
				$(parent).append(myMarkup);
				handler.m_domRoot = $("#" + myId);
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
			_domItemRoot: function(itemId) {
				return $("div[class~='panel'][data-item-id~='" + itemId + "']", handler.m_domRoot);
			},
			_domItemHeader: function(itemId) {
				return $("div[class~='panel'][data-item-id~='" + itemId + "'] div[class~='panel-heading']", handler.m_domRoot);
			},
			_domItemDetails: function(itemId) {
				return $("div[class~='panel'][data-item-id~='" + itemId + "'] div[class~='panel-collapse'][data-item-id~='"+ itemId +"']", handler.m_domRoot);
			},
			
			//internal slots
			_slot_itemLinkClicked: function(itemId) {
				handler.emit_itemLinkClicked(itemId);
				handler.toggle(itemId);
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
						handler.emit_itemDetailsOpened(itemId);
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
			scrollTo: function(itemId) {
				if (!handler.hasItem(itemId)) {
					return;
				}
				var itemPanelRootDiv = handler._domItemRoot(itemId);
				var scrollPos = itemPanelRootDiv.offset().top - handler.m_scrollContainer.offset().top + handler.m_scrollContainer.scrollTop();
				handler.m_scrollContainer.animate({scrollTop: scrollPos});
				//container.animate({scrollTop: itemPanelRootDiv.position().top + $("itemsList").position().top});
			},
			//returns jquery object of the inserted dom item element
			appendItem: function(item) {
				var itemTemplateData = state.resultListTemplateDataFromItem(item);
				var rendered = $.Mustache.render('itemListEntryHtmlTemplate', itemTemplateData);
				var inserted = $($(rendered).appendTo(this.m_domRoot));
				handler._addKeyValueQuery(inserted);
				$("a[class~='accordion-toggle']", inserted).on("click", function(e) {
					var me = $(this);
					var itemIdStr = me.attr("data-item-id");
					var itemId = parseInt(itemIdStr);
					handler._slot_itemLinkClicked(itemId);
				});
			},
			insertItem: function(item) {
				handler.appendItem(item);
			},
			insertItems: function(items) {
				handler.appendItems(items);
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
	//emits multiple signals on it self:
	var RegionItemListTabHandler = function(parent, scrollContainer) {
		if (scrollContainer === undefined) {
			scrollContainer = parent;
		}
		var handler = {
			m_domRoot : undefined,
			m_domTabRoot : undefined,
			m_scrollContainer: $(scrollContainer),
			m_regions : tools.SimpleHash(), //maps from regionId=<int> -> { handler : ItemListHandler, tabContentId: <string>, tabHeadId: <string>}
			
			//signals
			emit_itemDetailsOpened: function(itemId) {
				$(handler).triggerHandler({type:"itemDetailsOpened", itemId : itemId});
			},
			emit_itemDetailsClosed: function(itemId) {
				$(handler).triggerHandler({type:"itemDetailsClosed", itemId : itemId});
			},
			emit_itemLinkClicked: function(itemId) {
				$(handler).triggerHandler({type:"itemLinkClicked", itemId : itemId});
			},
			
			_init: function (parent) {
				var myDomRootId = tools.generateDocumentUniqueId();
				var myDomTabRootId = tools.generateDocumentUniqueId();
				var myDomRootHtml = '<div id="' + myDomRootId + '"></div>';
				var myDomTabRootHtml = '<ul id="' + myDomTabRootId + '"></ul>';
				$(parent).append(myDomRootHtml);
				handler.m_domRoot = $("#" + myDomRootId);
				handler.m_domRoot.append(myDomTabRootHtml);
				handler.m_domTabRoot = $("#" + myDomTabRootId);
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
				if (handler.m_regions.count(regionId)) {
					return handler.m_regions.at(regionId).handler;
				}
				//add a new tab
				var tabHeadId = tools.generateDocumentUniqueId();
				var tabContentId = tools.generateDocumentUniqueId();
				var tabHeadHtml = '<li id="' + tabHeadId + '" regionid="' + regionId + '"><a href="#' + tabContentId + '">' + regionName + '</a><span class="badge">' + itemCount + '</span></li>';
				var tabContentHtml = '<div id="' + tabContentId + '"></div>';
				$(handler.m_domTabRoot).append(tabHeadHtml);
				$(handler.m_domRoot).append(tabContentHtml);
				var tabContent = $('#' + tabContentId, handler.m_domRoot);
				var itemListHandler = ItemListHandler(tabContent, handler.m_scrollContainer);
				handler.m_regions.insert(regionId, {
					handler : itemListHandler,
					tabHeadId : tabHeadId,
					tabContentId : tabContentId
				});
				//take care of the signals emited from the list handler
				$(itemListHandler).on("itemDetailsOpened", function(e) { handler.emit_itemDetailsOpened(e.itemId); });
				$(itemListHandler).on("itemDetailsClosed", function(e) { handler.emit_itemDetailsClosed(e.itemId); });
				$(itemListHandler).on("itemLinkClicked", function(e) { handler.emit_itemLinkClicked(e.itemId); });
				handler.refresh();
				return handler.m_regions.at(regionId).handler;
			},
			insertItem: function(regionId, item) {
				if (handler.m_regions.count(regionId)) {
					handler.m_regions.at(regionId).handler.insertItem(item);
				}
			},
			insertItems: function(regionId, items) {
				if (handler.m_regions.count(regionId)) {
					handler.m_regions.at(regionId).handler.insertItems(items);
				}
			},
			//removes a region (and it's tab), return true, if removal was successfull
			removeRegion: function(regionId) {
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
				if (!handler.hasRegion(regionId)) {
					return;
				}
				var index = $("#" + handler.m_regions.at(regionId).tabHeadId).index();
				handler.m_domRoot.tabs("option", "active", index);
			},
			
			openItem: function(itemId) {
				for(var i in handler.m_regions.values()) {
					if (handler.m_regions.at(i).handler.hasItem(itemId)) {
						handler.openTab(i);
						handler.m_regions.at(i).handler.open(itemId);
						break;
					}
				}
			},
			//return handler of the active tab
			activeTab: function() {
				var index = handler.m_domRoot.tabs("option", "active");
				var li = handler.m_domTabRoot.children().eq(index);
				var regionIdStr = li.attr("regionid");
				var regionId = parseInt(regionIdStr);
				return handler.m_regions.at(regionId).handler;
			},
			
			refresh: function () {
				handler.m_domRoot.tabs("refresh");
				handler.m_domRoot.tabs("option", "active", 0);
			},

			clear: function() {
				for(var i in handler.m_regions.values()) {
					var info = handler.m_regions.at(i);
					info.handler.destroy();
					$('#' + info.tabContentId).destroy();
					$('#' + info.tabHeadId).destroy();
				}
				handler.refresh();
			},

			destroy: function () {
				handler.clear();
				handler.m_domRoot.tabs("destroy");
				handler.m_domRoot.destroy();
				handler.m_domRoot = undefined;
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
		this.m_forwardedSignals = {}, //add the name of the signals you want to process here in the form ["layer signal name", "map signal name"]
		this._handleEvent = function(e, itemId) {
			var targetSignals = this.m_forwardedSignals[e.type];
			if (targetSignals === undefined) {
				return;
			}
			for(var i in targetSignals) {
				var myE = $.Event(targetSignals[i]);
				myE.itemId = itemId;
				$(this).triggerHandler(myE);
			}
		};
		this._addSignalHandlers = function(layer, itemId) {
			var me = this;
			for(var i in this.m_forwardedSignals) {
				layer.on(i, function(e) {
					me._handleEvent(e, itemId);
				});
			}
		};
		this.domRoot = function() {
			return this.m_domRoot;
		};
		this.size = function() {
			return this.m_layers.size();
		};
		this.count = function(itemId) {
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
		this.add = function(itemId, extraArguments) {
			if (this.count(itemId)) {
				this.incRefCount(itemId);
				return;
			}
			this.incRefCount(itemId);
			var me = this;
			//call super class
			var cb = function(layer) {
				if (me.count(itemId) && me.layer(itemId) === undefined) {
					layer.itemId = itemId;
					me._addSignalHandlers(layer, itemId);
					me.setLayer(itemId, layer);
				};
			};
			if (extraArguments !== undefined) {
				this._fetchLayer(cb, itemId, extraArguments);
			}
			else {
				this._fetchLayer(cb, itemId);
			}
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
				return this.m_layers.at(itemId).layer;
			}
			return undefined;
		};
		//use this to iterate over all layers like so:
		//for(var l in layer()) { layer = handler.layer(l); do_sth.;}
		this.layers = function() {
			return this.m_layers.values();
		};
		this.zoomTo = function(itemId) {
			if (!this.count(itemId)) {
				return;
			}
			var ll = this.layer(itemId);
			this.m_target.fitBounds(ll.getBounds());
		};
		this.clear = function() {
			for(var i in this.m_layers.values()) {
				if (this.m_layers.at(i).layer !== undefined) {
					this.m_target.removeLayer(this.m_layers.at(i).layer);
				}
			}
			this.m_layers = tools.SimpleHash();
		};
		this.destroy = function() {
			this.clear();
		};
	};
	
	//The ShapeHandler handles the map shapes. It uses ref-counting to track the usage of shapes
	//Style is of the form:
	var ItemShapeHandler = function(target, style) {
		var handler = new ItemLayerHandler(target);
		handler.m_style = style;
		handler.m_forwardedSignals = {"click": ["click"]};
		//calls cb after adding if cb !== undefined
		handler._fetchLayer = function(cb, itemId) {
			var me = this;
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
			var l = this.layer(itemId);
			return l.getLatLng();
		};
		
		return handler;
	};

	var ItemMarkerHandler = function(target) {
		var handler = MarkerHandler(target);
		handler.m_forwardedSignals = {"click": ["click"]};
		handler._fetchLayer = function(cb, itemId) {
			oscar.getShape(itemId, function(shape) {
				var lfs = oscar.leafletItemFromShape(shape);
				if (lfs instanceof L.MultiPolygon) {
					geopos = lfs.getLatLngs()[0][0];
				}
				else if (lfs instanceof L.Polygon) {
					geopos = lfs.getLatLngs()[0];
				}
				else if (lfs instanceof L.Polyline) {
					geopos = lfs.getLatLngs()[0];
				}
				else {
					geopos = lfs.getLatLng();
				}
				var marker = L.marker(geopos);
				cb(marker);
			}, tools.defErrorCB);
		};
		return handler;
	};
	
	var RegionMarkerHandler = function(target) {
		var handler = MarkerHandler(target);
		handler.m_forwardedSignals = {"click" : ["click"], "mouseover": ["mouseover"], "mouseout": ["mouseout"]};
		handler._fetchLayer = function(cb, itemId, count) {
			console.assert(count !== undefined, count);
			oscar.getItem(itemId, function(item) {
				var marker = L.marker(item.centerPoint());
				marker.name = item.name();
				marker.bbox = item.bbox();
				marker.count = count;
				//needed by prototype.js and cluster-marker.js
				marker.rid = itemId;
				cb(marker);
			}, tools.defErrorCB);
		};
		return handler;
	};
	
	var SpatialQueryGeoObjectHandler = function() {
		var handler = MarkerHandler();
		handler.m_forwardedSignals = {"click": ["click"]};
		handler._fetchLayer = function(itemId, cb) {
			//fetched by internal id
			cb( state.spatialObjects.store.at(itemId).mapshape );
		};
		return handler;
	};
	
    var map = {
		ItemListHandler: ItemListHandler,
		RegionItemListTabHandler: RegionItemListTabHandler,
		ItemShapeHandler: ItemShapeHandler,
		ItemMarkerHandler: ItemMarkerHandler,
		RegionMarkerHandler: RegionMarkerHandler,
		
		resultListTabs: undefined,
		relativesTab: { activeItemHandler: undefined, relativesHandler: undefined },
		
		//map shapes
		itemShapes: undefined,
		regionShapes: undefined,
		relativesShapes: undefined,
		highlightItemShapes: undefined,
		clusterMarkerRegionShapes: undefined,
		
		//markers
		itemMarkers: ItemMarkerHandler(state.map),
		regionMarkers: RegionMarkerHandler(state.map),
		clusterMarkers: undefined,
		
		//this has to be called prior usage
		init: function() {
			map.resultListTabs = map.RegionItemListTabHandler('#left_menu_parent', '#sidebar-content');
			map.relativesTab.activeItemHandler = map.ItemListHandler($('#activeItemsList'));
			map.relativesTab.relativesHandler = map.ItemListHandler($('#relativesList'));
			
			//init the map layers
			map.itemShapes = map.ItemShapeHandler(state.map, config.styles.shapes.items.normal);
			map.regionShapes = map.ItemShapeHandler(state.map, config.styles.shapes.regions.normal);
			map.relativesShapes = map.ItemShapeHandler(state.map, config.styles.shapes.relatives.normal);
			map.highlightItemShapes = map.ItemShapeHandler(state.map, config.styles.shapes.activeItems);
			map.clusterMarkerRegionShapes = map.ItemShapeHandler(state.map, config.styles.shapes.regions.highlight);
			
			map.itemMarkers = map.ItemMarkerHandler(state.map);
			map.regionMarkers = map.RegionMarkerHandler(state.map);

			
			//init the cluster markers
            var myClusterMarkerGroup = L.markerClusterGroup();
            myClusterMarkerGroup.on('clusterclick', function (a) {
                a.layer.zoomToBounds();
            });
			state.map.addLayer(myClusterMarkerGroup);
			map.clusterMarkers = map.RegionMarkerHandler(myClusterMarkerGroup);
			
			//register slots
			$(map.resultListTabs).on("itemLinkClicked", map.onItemLinkClicked);
			$(map.resultListTabs).on("itemDetailsOpened", map.onItemDetailsOpened);
			$(map.resultListTabs).on("itemDetailsClosed", map.onItemDetailsClosed);
			
			$(map.itemMarkers).on("click", map.onItemMarkerClicked);
			
			$(map.regionMarkers).on("click", map.onRegionMarkerClicked);
			$(map.regionMarkers).on("mouseover", map.onRegionMarkerMouseOver);
			$(map.regionMarkers).on("mouseout", map.onRegionMarkerMouseOut);
			
			$(map.clusterMarkers).on("click", map.onClusterMarkerClicked);
			$(map.clusterMarkers).on("mouseover", map.onClusterMarkerMouseOver);
			$(map.clusterMarkers).on("mouseout", map.onClusterMarkerMouseOut);
		},
		
		displayCqr: function (cqr) {
			state.regionHandler = map.flatCqrTreeDataSource(cqr);
			var process = map.pathProcessor(cqr);
			state.dag.addRoot(0xFFFFFFFF);
			var root = state.dag.node(0xFFFFFFFF);
			root.count = cqr.rootRegionApxItemCount();
			root.name = "World";

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
	   
		onItemLinkClicked: function(e) {
			var itemId = e.itemId;
			state.items.activeItem = itemId;
			
			if (map.itemMarkers.count(itemId)) {
				var geopos = map.itemMarkers.coords(itemId);
				var text = "";
				if (oscar.itemCache.count(itemId)) {
					text = oscar.itemCache.at(itemId).name();
				}
				
				L.popup({offset: new L.Point(0, -25)})
					.setLatLng(geopos)
					.setContent(text).openOn(state.map);

				if ($('#show_flickr').is(':checked')) {
					flickr.getImagesForLocation($.trim(text), geopos);
				}
			}
		},
		
		//panel event handlers
		onItemDetailsOpened: function(e) {
			var itemId = e.itemId;
			map.highlightItemShapes.add(itemId, function() {
				if (state.items.activeItem == itemId) {
					map.highlightItemShapes.zoomTo(itemId);
				}
			});
		},
		onItemDetailsClosed: function(e) {
			var itemId = e.itemId;
			if (state.items.activeItem === itemId) {
				state.items.activeItem = -1;
			}
			map.highlightItemShapes.remove(itemId);
			flickr.closeFlickrBar();
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
			map.regionShapes.remove(e.itemId)
		},
		onClusterMarkerClicked: function(e) {
			map.closePopups();
			map.clusterMarkers.remove(e.itemId);
			state.regionHandler({rid: e.itemId, draw: true, dynamic: true});
		},
		onClusterMarkerMouseOver: function(e) {
			map.clusterMarkerRegionShapes.add(e.itemId);
			var coords = map.clusterMarkers.coords(e.itemId);
			var marker = map.clusterMarkers.layer(e.itemId);
			L.popup({offset: new L.Point(0, -10)})
				.setLatLng(coords)
				.setContent(marker.name).openOn(state.map);
		},
		onClusterMarkerMouseOut: function(e) {
			map.closePopups();
			map.clusterMarkerRegionShapes.remove(e.itemId)
		},
		//now for some old stuff, everything below needs refactoring


		flatCqrTreeDataSource: function (cqr) {
			function getItems(regionChildrenInfo, context) {
				var regionChildrenApxItemsMap = {};
				var childIds = [];
				var parentRid = context.rid;
				var parentNode = state.dag.at(parentRid);
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
									if (!state.dag.count(itemId)) {
										var node = state.dag.addNode(itemId);
										node.count = regionChildrenApxItemsMap[itemId];
										node.bbox = item.bbox();
										node.name = item.name();
									}
									state.dag.addChild(parentNode.id, itemId);
								}
							}
						}
						else if (parentCount > oscar.maxFetchItems) {
							for (var i in items) {
								item = items[i];
								itemId = item.id();
								itemMap[itemId] = item;
								if (!state.dag.count(itemId)) {
									node = state.dag.addNode(itemId);
									node.count = regionChildrenApxItemsMap[itemId];
									node.bbox = item.bbox();
									node.name = item.name();
								}
								state.dag.addChild(parentNode.id, itemId);
							}
						}

						// DAG-modification finished, now decide whether items should be loaded, or clusters be drawn
						if (!items.length || (parentCount <= oscar.maxFetchItems)) {
							if (context.draw || !cqr.ohPath().length || cqr.ohPath()[cqr.ohPath().length - 1] == parentRid) {
								$("#left_menu_parent").css("display", "block");

								if (cqr.ohPath().length) {
									state.cqr.regionItemIds(parentRid,
										map.visualizeRegionItems,
										tools.defErrorCB,
										0 // offset
									);
								}
								else {
									if (state.dag.at(parentRid).children.size() == 0) {
										state.cqr.regionItemIds(parentRid,
											map.visualizeRegionItems,
											tools.defErrorCB,
											0 // offset
										);
									}
									else {
										for (var child in state.dag.at(parentRid).children) {
											var id = state.dag.at(parentRid).children[child].id;
											state.cqr.regionItemIds(id,
												map.visualizeRegionItems,
												tools.defErrorCB,
												0 // offset
											);
										}
									}
								}
							}
						}
						else if (context.draw) {
							map.clusterMarkers.remove(parentRid);
							
							var j;
							var regions = [];
							for (var i in items) {
								j = itemMap[items[i].id()];
								if (!map.clusterMarkers.count(j.id())) {
									map.clusterMarkers.add(j.id(), state.dag.at(j.id()).count);
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

			return function(context) {
				spinner.startLoadingSpinner();
				cqr.regionChildrenInfo(context.rid, function (regionChildrenInfo) {
						spinner.endLoadingSpinner()
						getItems(regionChildrenInfo, context);
					},
					tools.defErrorCB
				);
			};
		},
		
		//TODO: improve this; its currently no possible to load more items into the result list
		//But this is necessary for large result regions
		visualizeRegionItems: function (regionId, itemIds) {
			console.assert(state.dag.hasNode(regionId), regionId);
			//cache items
			oscar.fetchItems(itemIds, function() {});
			
			//remove the cluster marker of this region
			map.clusterMarkers.remove(regionId);

			// manage items -> kill old items if there are too many of them and show clusters again
			if (map.itemMarkers.size() + itemIds.length > config.maxBufferedItems) {
				for (var itemId in map.itemmarkers.layers()) {
					node = state.dag.at(itemId);
					for (var parentId in node.parents.values()) {
						if (!map.clusterMarkers.count(parentId)) {
							map.clusterMarkers.add(parentId, node.count);
						}
					}
					map.itemMarkers.remove(node.id);
					dag.removeNode(node.id);
				}
			}
			
			//add the appropriate tab to the result list and insert the items to the list
			map.resultListTabs.addRegion(regionId, state.dag.at(regionId).name, state.dag.at(regionId).count);
			
			//insertItems expects items
			oscar.getItems(itemIds, function(items) {
				map.resultListTabs.insertItems(regionId, items);
			
				//add the items as children to the dag
				for(var i in items) {
					var item = items[i];
					var itemId = item.id();
					var node = state.dag.addNode(itemId);
					node.name = item.name();
					state.dag.addChild(regionId, itemId);
				}
				if (state.visualizationActive) {
					tree.refresh(regionId);
				}
			});
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
						parentNode = state.dag.at(rid);

						for (var i in items) {
							item = items[i];
							itemId = item.id();
							if (!state.dag.count(itemId)) {
								node = state.dag.addNode(itemId);
								node.count = regionChildrenApxItemsMap[itemId];
								node.bbox = item.bbox();
								node.name = item.name();
								state.dag.addChild(parentNode.id, itemId);
								map.addClusterMarker(state.dag.at(itemId));
							}
						}

						if ($("#onePath").is(':checked')) {
							tree.onePath(parentNode);
						}
						else if (state.visualizationActive) {
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
				state.dag = tools.SimpleHash();
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
							
							state.dag.insert(itemId);
							var node = state.dag.at(itemId);
							node.name = item.name();
							node.count = regionInSubSet.apxitems;
							node.bbox = item.bbox();

							for (var i in regionInSubSet.children) {
								var childId = regionInSubSet.children[i];
								state.dag.addNode(childId);
								state.dag.addChild(itemId, childId);
							}
						}

						for (var j in subSet.rootchildren) {
							var childId = subSet.rootchildren[j];
							state.dag.addNode(childId);
							state.dag.addChild(0xFFFFFFFF, childId);
						}
					},
					oscar.defErrorCB
				);
			}

			state.cqr.getDag(subSetHandler, tools.defErrorCB);
		},
		
		loadItems: function (rid) {
			state.cqr.regionItemIds(rid,
				map.visualizeRegionItems,
				tools.defErrorCB,
				0 // offset
			);
		},
	   
		addDagItemToResultList: function (node) {
			for (var parent in node.parents.values()) {
				var parentNode = state.dag.at(parent);
				map.resultListTabs.addRegion(parentNode.id, parentNode.name, parentNode.count);
				//insert
				oscar.getItem(node.id, function (item) {
					map.resultListTabs.insertItem(parentNode.id, item);
				}, tools.defErrorCB);
			}
		},
		//@param drawn: item markers that are already on the map
		drawClusters: function (node, drawn) {
			if (!node) {
				return;
			}

			var childNode;
			if (node.children.size()) {
				for (var childId in node.children.values()) {
					childNode = state.dag.at(childId);
					if (tools.percentOfOverlap(state.map, childNode.bbox) >= config.overlap) {
						map.drawClusters(childNode, drawn);
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

		removeClusterMarker: function (node) {
			map.clusterMarkers.remove(node.id);
		},

		addClusterMarker: function (node) {
			if (node.count === 1006) {
				console.log("BOOM");
			}
			map.clusterMarkers.add(node.id, node.count);
		},

		removeItemMarker: function (node) {
			map.itemMarkers.remove(node.id);
		},

		addItemMarker: function (node) {
			map.itemMarkers.add(node.id);
		},

		removeParentsTabs: function (dagChildNode) {
			for (var parentId in dagChildNode.parents.values()) {
				map.resultListTabs.removeRegion(parentId);
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
							state.map.fitBounds(state.dag.at(this.path[this.path.length - 1]).bbox);
						}
						else {
							state.map.fitWorld();
						}
						state.handler = function () {
							var timer = tools.timer("draw");
							var drawn = tools.SimpleHash();
							var removedParents = tools.SimpleHash();

							for (var itemId in map.itemMarkers.layers()) {
								drawn.insert(itemId, false);
							}
							
							map.closePopups();
							map.clusterMarkers.clear();

							if (this.path && this.path.length) {
								// start at the target region (last element of ohPath)
								map.drawClusters(state.dag.at(this.path[this.path.length - 1]), drawn);
							} else {
								// start at Node "World"
								map.drawClusters(state.dag.at(0xFFFFFFFF), drawn);
							}

							// remove all markers (and tabs) that are redundant
							for (var itemId in drawn.values()) {
								if (drawn.at(itemId) == false) {
									map.removeItemMarker(state.dag.at(itemId));
									map.removeParentsTabs(state.dag.at(itemId));
								}
							}

							timer.stop();
						}.bind(this);
						state.map.on("zoomend dragend", state.handler);
					}
				}
			};
		}
    };
	console.assert(state.map === undefined, state.map);
	// init the map and sidebar
	state.map = L.map('map', {
		zoomControl: true
	}).setView([48.74568, 9.1047], 17);
	state.map.zoomControl.setPosition('topright');
	state.sidebar = L.control.sidebar('sidebar').addTo(state.map);
	var osmAttr = '&copy; <a target="_blank" href="http://www.openstreetmap.org">OpenStreetMap</a>';
	L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: osmAttr}).addTo(state.map);
	
	//init map module
	map.init();

	return map;
});