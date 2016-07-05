//This module handles most stuff associated with the map-gui. It HAS to be a singleton!
define(["require", "state", "jquery", "conf", "oscar", "flickr", "tools", "tree", "bootstrap", "spinner", "leaflet", "dag", "dagexp"],
function (require, state, $, config, oscar, flickr, tools, tree) {
    var spinner = require("spinner");
	var L = require("leaflet");
	var dag = require("dag");
	var dagexp = require("dagexp");

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
			m_itemIds: tools.SimpleSet(),
			m_eventHandlers : {
				itemIdQuery: function(e) {
					var me = $(this);
					var myItemId = me.attr('data-item-id');
					if (myItemId === undefined) {
						return false;
					}
					var myQstr = "$item:" + myItemId;
					tools.addSingleQueryStatementToQuery(myQstr);
					return false;
				},
				itemDetailQuery: function(e) {
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
				},
				itemLinkClicked: function(e) {
					var me = $(this);
					var itemIdStr = me.attr("data-item-id");
					var itemId = parseInt(itemIdStr);
					handler._slot_itemLinkClicked(itemId);
				}
			},
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
	   
			_addEventHandlers: function(elements) {
				//this function takes for 1k elements
				//170 ms with elements=m_domRoot or elements empty
				//800 ms with elements set to the array of inserted elements
				//1k elements -> 235 ms. Make sure that handlers are only attached once!
				var keyC = $(".item-detail-key", elements);
				var valC = $(".item-detail-value", elements);
				var detC = $(".item-detail-id", elements);
				var actC = $(".accordion-toggle-link", elements);
				
				var myClickNS = "click.ilhevh";
				keyC.unbind(myClickNS).bind(myClickNS, handler.m_eventHandlers.itemDetailQuery);
				valC.unbind(myClickNS).bind(myClickNS, handler.m_eventHandlers.itemDetailQuery);
				detC.unbind(myClickNS).bind(myClickNS, handler.m_eventHandlers.itemIdQuery);
				actC.unbind(myClickNS).bind(myClickNS, handler.m_eventHandlers.itemLinkClicked);
			},
			_renderItem: function(item) {
				var itemTemplateData = state.resultListTemplateDataFromItem(item);
				var rendered = $.Mustache.render('itemListEntryHtmlTemplate', itemTemplateData);
				return rendered;
			},
			//returns jquery object of the inserted dom item element
			_appendItem: function(item) {
				var rendered = handler._renderItem(item);
				var inserted = $($(rendered).appendTo(this.m_domRoot));
				handler._addEventHandlers(inserted);
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
	   
			//use this to iterate over itemIds
			values: function() {
				return handler.m_itemIds.values();
			},
	   
			//calls cb for each handled itemId
			each: function(cb) {
				handler.m_itemIds.each(cb);
			},
			
			hasItem: function(itemId) {
				return handler.m_itemIds.count(itemId);
			},
	   
			count: function(itemId) {
				return handler.hasItem(itemId);
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
			insert: function(item) {
				handler.insertItem(item);
			},
			insertItem: function(item) {
				if (!handler.hasItem(item.id())) {
					handler._appendItem(item);
					handler.m_itemIds.insert(item.id());
				}
			},
			insertItems: function(items) {
				var timer0 = tools.timer("ItemListHandler::insertItems::domFilterData for " + items.length + " items");
				var itemData = [];
				for(var i in items) {
					if (!handler.hasItem(items[i].id())) {
						itemData.push(state.resultListTemplateDataFromItem(items[i]));
					}
				}
				timer0.stop();
				var timer1 = tools.timer("ItemListHandler::insertItems::domRender for " + items.length + " items");
				var toInsert = $($.Mustache.render('arrayItemListEntryHtmlTemplate', {wrappedarray: itemData}));
				timer1.stop();
				
				var timer2 = tools.timer("ItemListHandler::insertItems::domInsert for " + items.length + " items");
				var inserted = $($(toInsert).appendTo(this.m_domRoot));
				timer2.stop();
				
				var timer3 = tools.timer("ItemListHandler::insertItems::domAddEventHandlers for " + items.length + " items");
				handler._addEventHandlers(handler.m_domRoot);
				timer3.stop();
				
				var timer4 = tools.timer("ItemListHandler::insertItems::idUpdate for " + items.length + " items");
				for(var i in items) {
					handler.m_itemIds.insert(items[i].id());
				}
				timer4.stop();
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
				handler.m_itemIds.clear();
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
			//maps from regionId=<int> ->
			//{ handler : ItemListHandler,
			//  tabContentId: <string>,
			//  tabHeadId: <string>,
			//  cells: tools.SimpleSet()
			//}
			m_regions : tools.SimpleHash(), 
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
			
			//if no tab is active, then rid=-1
			emit_activeRegionChanged: function(newRegionId) {
				$(handler).triggerHandler({
					type: "activeRegionChanged",
					rid: newRegionId,
					newRegionId: newRegionId
				});
			},
			
			_slot_activeRegionChanged: function() {
				handler.emit_activeRegionChanged(handler.activeRegion());
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
				//register events
				handler.m_domRoot.on("tabsactivate", function(event, ui) {
					handler._slot_activeRegionChanged();
				});
			},
	   
			//Do not use this except for iterating over all available regions
			values: function() {
				return handler.m_regions.values();
			},
	   
			cells: function(regionId) {
				return handler.m_regions.at(regionId).cells;
			},
			
			///cells must be of type tools.SimpleSet()
			setCells: function(regionId, cells) {
				if (handler.hasRegion(regionId)) {
					handler.m_regions.at(regionId).cells = cells;
				}
			},
	   
			size: function() {
				return handler.m_regions.size();
			},
			
			domRoot: function() {
				return handler.m_domRoot;
			},
			hasRegion: function(regionId) {
				return handler.m_regions.count(regionId);
			},
			count: function(regionId) {
				return handler.hasRegion(regionId);
			},
			itemListHandler: function(regionId) {
				return handler.m_regions.at(regionId).handler;
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
					tabContentId : tabContentId,
					cells: tools.SimpleSet()
				});
				//take care of the signals emited from the list handler
				$(itemListHandler).on("itemDetailsOpened", function(e) { handler.emit_itemDetailsOpened(e.itemId); });
				$(itemListHandler).on("itemDetailsClosed", function(e) { handler.emit_itemDetailsClosed(e.itemId); });
				$(itemListHandler).on("itemLinkClicked", function(e) { handler.emit_itemLinkClicked(e.itemId); });
				var myActiveRegionId = handler.activeRegion();
				handler.refresh();
				if (myActiveRegionId !== -1) {
					handler.openTab(myActiveRegionId);
				}
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
					var myActiveRegionId = handler.activeRegion();
					var v = handler.m_regions.at(regionId);
					v.handler.destroy();
					$("#" + v.tabHeadId ).remove();
					$("#" + v.tabContentId ).remove();
					handler.m_regions.erase(regionId);
					handler.refresh();
					if (regionId !== myActiveRegionId && myActiveRegionId !== -1) {
						handler.openTab(myActiveRegionId);
					}
					//check if this was the last region we have,
					//since then there will be no new active region
					if (!handler.size()) {
						handler.emit_activeRegionChanged(-1);
					}
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
				if (!handler.size()) {
					return;
				}
				if (handler.activeTab().hasItem(itemId)) {
					handler.activeTab().open(itemId);
				}
				else {
					for(var i in handler.m_regions.values()) {
						if (handler.m_regions.at(i).handler.hasItem(itemId)) {
							handler.openTab(i);
							handler.m_regions.at(i).handler.open(itemId);
							break;
						}
					}
				}
			},
	   
			activeRegion: function() {
				if (!handler.m_regions.size()) {
					return -1;
				}
				var index = handler.m_domRoot.tabs("option", "active");
				var li = handler.m_domTabRoot.children().eq(index);
				var regionIdStr = li.attr("regionid");
				var regionId = parseInt(regionIdStr);
				return regionId;
			},
	   
			//return handler of the active tab
			activeTab: function() {
				var regionId = handler.activeRegion();
				if (regionId < 0) {
					return undefined;
				}
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
					$('#' + info.tabContentId).remove();
					$('#' + info.tabHeadId).remove();
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
		this.m_layers = tools.SimpleHash(); //maps from id -> {layer: LeafletLayer, refCount: <int> }
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
			this.addWithCallback(itemId, undefined, extraArguments);
		};
		//todo remove this in favor of ... syntax
		///calls cb after adding this to the map
		this.addWithCallback = function(itemId, cb, extraArguments) {
			if (this.count(itemId)) {
				this.incRefCount(itemId);
				return;
			}
			this.incRefCount(itemId);
			var me = this;
			//call super class
			var mycb = function(layer) {
				if (me.count(itemId) && me.layer(itemId) === undefined) {
					layer.itemId = itemId;
					me._addSignalHandlers(layer, itemId);
					me.setLayer(itemId, layer);
					if (cb !== undefined) {
						cb();
					}
				};
			};
			if (extraArguments !== undefined) {
				this._fetchLayer(mycb, itemId, extraArguments);
			}
			else {
				this._fetchLayer(mycb, itemId);
			}
		},
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
		//for(var l in layers()) { layer = handler.layer(l); do_sth.;}
		this.layers = function() {
			return this.m_layers.values();
		};
		//the same as layers()
		this.values = function() {
			return this.layers();
		},
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
				if (shape.t === oscar.ShapeTypes.MultiPolygon) {
					geopos = shape.v.outer[0][0];
				}
				else if (shape.t === oscar.ShapeTypes.Polygon) {
					geopos = shape.v[0];
				}
				else if (shape.t === oscar.ShapeTypes.Way) {
					geopos = shape.v[0];
				}
				else {
					geopos = shape.v;
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
				var markerPos;
				if (state.dag.hasRegion(itemId) && state.dag.region(itemId).clusterHint !== undefined) {
					markerPos = state.dag.region(itemId).clusterHint;
				}
				else {
					markerPos = item.centerPoint();
				}
				var marker = L.marker(markerPos);
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
		relativesShapes: undefined,
		highlightItemShapes: undefined,
		clusterMarkerRegionShapes: undefined,
		
		//markers
		itemMarkers: ItemMarkerHandler(state.map),
		clusterMarkers: undefined,
		
		//dag handling
		dagExpander: dagexp.dagExpander(),
		
		//cfg
		cfg: {
			//call reloadShapeConfig() after changing stuff
			clusterShapes: {
				auto: true,
				display: true,
				preload: true,
				threshold: 25 //maximum # root children to display shapes
			},
			resultList: {
				bulkItemFetchCount: 100
			}
		},
		
		//this has to be called prior usage
		init: function() {
			map.resultListTabs = map.RegionItemListTabHandler('#left_menu_parent', '#sidebar-content');
			map.relativesTab.activeItemHandler = map.ItemListHandler($('#activeItemsList'));
			map.relativesTab.relativesHandler = map.ItemListHandler($('#relativesList'));
			
			//init the map layers
			map.itemShapes = map.ItemShapeHandler(state.map, config.styles.shapes.items.normal);
			map.relativesShapes = map.ItemShapeHandler(state.map, config.styles.shapes.relatives.normal);
			map.highlightItemShapes = map.ItemShapeHandler(state.map, config.styles.shapes.activeItems);
			map.clusterMarkerRegionShapes = map.ItemShapeHandler(state.map, config.styles.shapes.regions.highlight);
			
			map.itemMarkers = map.ItemMarkerHandler(state.map);

			
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
			$(map.resultListTabs).on("activeRegionChanged", map.onActiveTabChanged);
			
			$(map.itemMarkers).on("click", map.onItemMarkerClicked);
			
			$(map.clusterMarkers).on("click", map.onClusterMarkerClicked);
			$(map.clusterMarkers).on("mouseover", map.onClusterMarkerMouseOver);
			$(map.clusterMarkers).on("mouseout", map.onClusterMarkerMouseOut);
		},
		
		clear: function() {
			state.map.off("zoomend dragend", map.viewChanged);
			
			state.dag.clear();
			
			map.resultListTabs.clear();
			map.relativesTab.activeItemHandler.clear();
			map.relativesTab.relativesHandler.clear();
			
			map.itemShapes.clear();
			map.relativesShapes.clear();
			map.highlightItemShapes.clear();
			map.clusterMarkerRegionShapes.clear();
			
			map.itemMarkers.clear();
			map.clusterMarkers.clear();
		},
	   
		//call this after changing options regarding shape handling
		reloadShapeConfig: function() {
			if (map.cfg.clusterShapes.auto) {
				if (state.cqr.rootRegionChildrenInfo().length > map.cfg.clusterShapes.threshold) {
					map.cfg.clusterShapes.preload = false;
					map.cfg.clusterShapes.display = false;
				}
				else {
					map.cfg.clusterShapes.preload = true;
					map.cfg.clusterShapes.display = true;
				}
			}
			map.dagExpander.setPreloadShapes(map.cfg.clusterShapes.preload);
			map.dagExpander.setBulkItemFetchCount(map.cfg.resultList.bulkItemFetchCount);
		},
	   
		displayCqr: function (cqr) {
			map.clear();
			if (!cqr.hasResults()) {
				return;
			}
			map.reloadShapeConfig();
			state.dag.addRoot(0xFFFFFFFF);
			var root = state.dag.region(0xFFFFFFFF);
			root.count = cqr.rootRegionApxItemCount();
			root.name = "World";
			
			map.startClustering();
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
				map.relativesTab.activeItemHandler.insertItem(item);
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
					map.relativesTab.relativesHandler.insertItems(relatives);
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
			map.highlightItemShapes.addWithCallback(itemId, function() {
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
		
		//removes old item markers and adds the new ones (if needed)
		//Note: there may be no active region present!
		onActiveTabChanged: function(e) {
			var wantItemMarkers;
			if (!map.resultListTabs.size()) {
				wantItemMarkers = tools.SimpleSet();
			}
			else {
				wantItemMarkers = map.resultListTabs.activeTab();
			}
			var removedIds = tools.SimpleSet();
			var missingIds = tools.SimpleSet();
			tools.getMissing(wantItemMarkers, map.itemMarkers, removedIds, missingIds);
			removedIds.each(function(itemId) {
				map.itemMarkers.remove(itemId);
				state.dag.item(itemId).displayState &= ~dag.DisplayStates.HasItemMarker;
			});
			missingIds.each(function(itemId) {
				map.itemMarkers.add(itemId);
			});
			//mark dag nodes accordingly
			var tmp = map.itemMarkers.values();
			for(var itemId in tmp) {
				state.dag.item(itemId).displayState |= dag.DisplayStates.HasItemMarker;
			}
		},
	   
		onItemMarkerClicked: function(e) {
			state.items.activeItem = e.itemId;
			map.resultListTabs.openItem(e.itemId);
			map.resultListTabs.activeTab().scrollTo(e.itemId);
			map.showItemRelatives();
		},
		onClusterMarkerClicked: function(e) {
			map.closePopups();
			map.clusterMarkers.remove(e.itemId);
			map.zoomTo(e.itemId);
			if (state.dag.region(e.itemId).isLeaf) {
				map.expandDagItems(e.itemId, function() {
					map.mapViewChanged();
				});
			}
			else {
				map.expandRegion(e.itemId, function() {
					map.mapViewChanged();
				});
			}
		},
		onClusterMarkerMouseOver: function(e) {
			if (map.cfg.clusterShapes.display) {
				map.clusterMarkerRegionShapes.add(e.itemId);
			}
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

		loadWholeTree: function () {
			map.dagExpander.loadAll(function() {
				map.mapViewChanged();
				tree.visualizeDAG(state.dag.region(0xFFFFFFFF));
			});
		},
		
		zoomTo: function(regionId) {
			if (state.dag.region(regionId)) {
				state.map.fitBounds(state.dag.region(regionId).bbox);
			}
		},
		
		//get the top-k items that are in the cells specified by cells which is an array;
		topKItems: function(k, offset, cellIds, cb) {
			map.dagExpander.expandCellItems(cellIds, function() {

				//iterators would be nice
				var tmp = tools.SimpleSet();
				for(var i in cellIds) {
					var cellNode = state.dag.cell(cellIds[i]);
					for(var itemId in cellNode.items.values()) {
						tmp.insert(itemId);
					}
				}
				var ret = [];
				for(var itemId in tmp.values()) {
					if (!offset) {
						ret.push(itemId);
					}
					else {
						--offset;
					}
					if (ret.length == k) {
						break;
					}
				}
				
				cb(ret);
				
			}, offset);
		},
	   
		//this is recursive function, you have to clear the displayState of the dag before calling
		//childrenToFetch should be of type tools.SimpleSet() and will contain the nodes that should be expanded
		//cellsToFetch will contain the nodes whose cells are needed
		updateDag: function(node, childrenToFetch, cellsToFetch) {
			if (!node) {
				return;
			}

			if (node.children.size()) {
				for (var childId in node.children.values()) {
					
					var childNode = state.dag.region(childId);
					var myOverlap = tools.percentOfOverlap(state.map, childNode.bbox);

					if (myOverlap >= config.clusters.bboxOverlap) {
						map.updateDag(childNode, childrenToFetch, cellsToFetch)
						childNode.displayState |= dag.DisplayStates.InResultsTab;
						if (!childNode.cells.size()) {
							cellsToFetch.insert(childNode.id);
						}
					}
					else if (myOverlap > config.clusters.shapeOverlap &&
							oscar.shapeCache.count(childNode.id) &&
							oscar.intersect(state.map.getBounds(), oscar.shapeCache.at(childNode.id)))
					{
						map.updateDag(childNode, childrenToFetch, cellsToFetch);
						childNode.displayState |= dag.DisplayStates.InResultsTab;
						if (!childNode.cells.size()) {
							cellsToFetch.insert(childNode.id);
						}
					}
					else { //overlap is smaller, only draw the cluster marker
						if ((childNode.clusterHint !== undefined && state.map.getBounds().contains(childNode.clusterHint)) ||
							oscar.itemCache.count(childNode.id) && state.map.getBounds().contains(oscar.itemCache.at(childNode.id).centerPoint())
							)
						{
							childNode.displayState |= dag.DisplayStates.HasClusterMarker;
						}
					}
				}
			}
			else if (node.isLeaf) {
				node.displayState |= dag.DisplayStates.InResultsTab;
				if (!node.cells.size()) {
					cellsToFetch.insert(node.id);
				}
			}
			else {//fetch children
				childrenToFetch.insert(node.id);
			}
		},
		
		viewChanged: function() {
			if (state.dag.hasRegion(0xFFFFFFFF)) {
				map.mapViewChanged(0xFFFFFFFF);
			}
		},
		
		expandDagItems: function(parentId, cb, offset) {
			map.dagExpander.expandDagItems(parentId, cb, offset);
		},
		
		expandRegion: function(parentId, cb) {
			map.dagExpander.expandRegion(parentId, cb);
		},
		
		mapViewChanged: function(startNode) {
			if (startNode === undefined) {
				startNode = 0xFFFFFFFF;
			}
			
			//callback handler
			cbh = undefined;
			
			var timers = {
				complete: tools.timer("mapViewChanged::complete"),
				dagClear: tools.timer("mapViewChanged::dagClear"),
				updateDag: tools.timer("mapViewChanged::updateDag"),
				viewDiff: tools.timer("mapViewChanged::viewDiff"),
				mapUpdate: tools.timer("mapViewChanged::mapUpdate"),
				clusterUpdate: tools.timer("mapViewChanged::clusterUpdate"),
				handleTabs: tools.timer("mapViewChanged::handleTabs"), 
				tabUpdate: tools.timer("mapViewChanged::tabUpdate"),
				tabRemove: tools.timer("mapViewChanged::tabRemove"),
				tabAdd: tools.timer("mapViewChanged::tabAdd")
			};
			
			
			state.dag.clearDisplayState();
			timers.dagClear.stop();
			
			map.closePopups();
			
			timers.updateDag.start();
			var childrenToFetch = tools.SimpleSet();
			var cellsToFetch = tools.SimpleSet();
			map.updateDag(state.dag.region(0xFFFFFFFF), childrenToFetch, cellsToFetch);
			
			//get the children and the cells of regions that expand their cells
			if (childrenToFetch.size() || cellsToFetch.size()) {
				cbh = tools.AsyncCallBackHandler(3, function() {
					map.mapViewChanged();
				});
				var myWrapper = function(regionsToExpand, regionCellsToExpand, cbh) {
					if (regionsToExpand.length) {
						map.dagExpander.expandRegionChildren(regionsToExpand, function() { cbh.inc();});
					}
					else{
						cbh.inc();
					}
					if (regionCellsToExpand.length) {
						map.dagExpander.expandRegionCells(regionCellsToExpand, function() { cbh.inc();});
					}
					else {
						cbh.inc();
					}
				}
				myWrapper(childrenToFetch.toArray(), cellsToFetch.toArray(), cbh);
			}
			
			//now mark all the cells accordingly
			state.dag.each(function(node) {
				for(var cellId in node.cells.values()) {
					state.dag.cell(cellId).displayState |= node.displayState;
				}
			}, dag.NodeTypes.Region);
			
			//and now check for each region that has the displayState == InResultsTab
			//if at least one of its cells that overlaps the current map bounds has the state InResultsTab
			var currentMapBounds = state.map.getBounds();
			state.dag.each(function(node) {
				if (node.displayState & dag.DisplayStates.InResultsTab) {
					var ok = false;
					for(var cellId in node.cells.values()) {
						var cellNode = state.dag.cell(cellId);
						var ds = cellNode.displayState & dag.DisplayStates.HasClusterMarker;
						var xMap = currentMapBounds.intersects(cellNode.bbox);
						var pOv =tools.percentOfOverlap(state.map, cellNode.bbox);
						if (ds === 0 &&
							xMap &&
							pOv >= config.clusters.shapeOverlap)
						{
							ok = true;
						}
						else { //don't put it into the results tab
							cellNode.displayState &= ~dag.DisplayStates.InResultsTab;
						}
					}
					if (!ok) {
						node.displayState &= ~dag.DisplayStates.InResultsTab;
					}
				}
			}, dag.NodeTypes.Region);
			
			//cells now hold the correct display state (either InResultsTab or HasClusterMarker)
			//regions now hold the correct display state as well
			timers.updateDag.stop();
			
			//the dag now holds the state the gui should have
			//let's get them synchronized
			//recycle as many markers, tabs etc. as possible
			//remove disabled markers/tabs etc
			//add new markers/tabs etc.
			timers.viewDiff.start();
			var wantTabListRegions = tools.SimpleSet();
			var wantClusterMarkers = tools.SimpleSet();
			state.dag.dfs(state.dag.region(0xFFFFFFFF), function(node) {
				if (node.displayState & dag.DisplayStates.HasClusterMarker) {
					wantClusterMarkers.insert(node.id);
				}
				if(node.displayState & dag.DisplayStates.InResultsTab) {
					wantTabListRegions.insert(node.id);
				}
			}, dag.NodeTypes.Region);
			
			//now check for missing cluster markers etc.
			var removedClusterMarkers = tools.SimpleSet();
			var removedTabListRegions = tools.SimpleSet();
			var missingClusterMarkers = tools.SimpleSet();
			var missingTabListRegions = tools.SimpleSet();
			tools.getMissing(wantTabListRegions, map.resultListTabs, removedTabListRegions, missingTabListRegions);
			tools.getMissing(wantClusterMarkers, map.clusterMarkers, removedClusterMarkers, missingClusterMarkers);
			timers.viewDiff.stop();
			
			console.log("mapViewChanged::ClusterMarkers haveCount=" + map.clusterMarkers.size() +
				", removeCount=" + removedClusterMarkers.size() +
				", missingCount=" + missingClusterMarkers.size()
			);
			console.log("mapViewChanged::Tabs haveCount=" + map.resultListTabs.size() +
				", removeCount=" + removedTabListRegions.size() +
				", missingCount=" + missingTabListRegions.size()
			);
			
			timers.mapUpdate.start();
			timers.clusterUpdate.start();
			removedClusterMarkers.each(function(key) {
				map.clusterMarkers.remove(key);
			});
			missingClusterMarkers.each(function(key) {
				map.clusterMarkers.add(key, state.dag.region(key).count);
			});
			timers.clusterUpdate.stop();
			
			
			timers.handleTabs.start();
			timers.tabRemove.start();
			removedTabListRegions.each(function(key) {
				map.resultListTabs.removeRegion(key);
			});
			timers.tabRemove.stop();
			
			var tabPopulate = function(itemIds, ilh) {
				//TODO: add ability to remove single results
				ilh.clear();
				//this should return instantly since the items are in the cache
				oscar.getItems(itemIds, function(items) {
					console.assert(itemIds.length == items.length);
					if (!map.resultListTabs.count(regionId)) {
						return;
					}
					ilh.insertItems(items);
					if (map.resultListTabs.size() === 1) {
						map.resultListTabs.emit_activeRegionChanged(regionId);
					}
				});
			}
			
			timers.tabUpdate.start();
			//check if the currently active tabs have all the items of the current cells
			//and if there are any items that should not be there
			for(var regionId in map.resultListTabs.values()) {
				var wantCells = tools.SimpleSet();
				for(var cellId in state.dag.region(regionId).cells.values()) {
					if (state.dag.cell(cellId).displayState & dag.DisplayStates.InResultsTab) {
						wantCells.insert(cellId);
					}
				}
				var removedCells = tools.SimpleSet();
				var missingCells = tools.SimpleSet();
				tools.getMissing(wantCells, map.resultListTabs.cells(regionId), removedCells, missingCells);
				
				//nothing to change
				if (!missingCells.size() && ! removedCells.size()) {
					continue;
				}
				map.resultListTabs.setCells(regionId, wantCells);
				
				var topKItems = map.topKItems(map.cfg.resultList.bulkItemFetchCount, 0, wantCells.toArray());
				var ilh = map.resultListTabs.itemListHandler(regionId);
				tabPopulate(topKItems, ilh);
			}
			timers.tabUpdate.stop();
			
			timers.tabAdd.start();
			missingTabListRegions.each(function(regionId) {
				var rn = state.dag.region(regionId);
				map.resultListTabs.addRegion(regionId, rn.name, rn.count);
				
				var wantCells = tools.SimpleSet();
				for(var cellId in state.dag.region(regionId).cells.values()) {
					if (state.dag.cell(cellId).displayState & dag.DisplayStates.InResultsTab) {
						wantCells.insert(cellId);
					}
				}
				map.resultListTabs.setCells(regionId, wantCells);
				
				var topKItems = map.topKItems(map.cfg.resultList.bulkItemFetchCount, 0, wantCells.toArray());
				var ilh = map.resultListTabs.addRegion(regionId, node.name, node.count);
				tabPopulate(topKItems, ilh);
			});
			timers.tabAdd.stop();
			timers.handleTabs.stop();
			timers.mapUpdate.stop();
			timers.complete.stop();
			if(cbh !== undefined) {
				cbh.inc();
			}
		},
		
		//starts the clustering by expanding the view to the ohPath
		//it then hand everything off to mapViewChanged
		startClustering: function() {
			var cqr = state.cqr;
			spinner.startLoadingSpinner();
			map.dagExpander.expandRegionChildren(([0xFFFFFFFF]).concat(cqr.ohPath()), function() {
				spinner.endLoadingSpinner();
				//everything is there
				var rid = 0xFFFFFFFF;
				// fit the viewport to the target region
				if (cqr.ohPath().length) {
					var path = cqr.ohPath();
					rid = path[path.length - 1];
					state.map.fitBounds(state.dag.region(rid).bbox);
				}
				else {
					state.map.fitWorld();
				}
				map.mapViewChanged(rid);
				state.map.on("zoomend dragend", map.viewChanged);
			});
		},
	   
		closePopups: function () {
			var closeElement = $(".leaflet-popup-close-button")[0];
			if (closeElement !== undefined) {
				closeElement.click();
			}
		},

		addClusterMarker: function (node) {
			map.clusterMarkers.add(node.id, node.count);
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