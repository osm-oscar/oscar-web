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
			m_inFlightItems: tools.SimpleSet(),
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
			_item2RenderData: function(item) {
				return state.resultListTemplateDataFromItem(item);
			},
			_renderItems: function(items) {
				var itemData = [];
				for(var i in items) {
					itemData.push(handler._item2RenderData(items[i]));
				}
				var rendered = $.Mustache.render('arrayItemListEntryHtmlTemplate', {wrappedarray: itemData});
				return rendered;
			},
			_renderItem: function(item) {
				return handler._renderItems([item]);
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
			
			active: function(cb) {
				each(function(itemId) {
					if (handler._domItemDetails(itemId).hasClass("in")) {
						cb(itemId);
					}
				});
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
			//a multi purpous insert function,
			insert: function(data) {
				if (typeof data === "string" || typeof data === "number") {
					handler.insertItemId(data);
				}
				else if (data instanceof Array) {
					if (!data.length) {
						return;
					}
					if (typeof data[0] === "string" || typeof data[0] === "number") {
						handler.insertItemIds(data);
					}
					else {
						handler.insertItems(data);
					}
				}
				else {
					handler.insertItem(item);
				}
			},
			insertItemIds: function(itemIds) {
				var needItemIds = [];
				for(var i in itemIds) {
					if (!handler.count(itemIds[i]) && !handler.m_inFlightItems.count(itemIds[i])) {
						needItemIds.insert(itemIds[i]);
					}
				}
				handler.m_inFlightItems.insertArray(needItemIds);
				oscar.getItems(needItemIds, function(items) {
					var needItems = [];
					for(var i in items) {
						if (handler.m_inFlightItems.count(items[i].id())) {
							needItems.push(items[i]);
						}
					}
					if (needItems.length) {
						handler.insertItems(needItems);
					}
					for (var i in needItemIds) {
						handler.m_inFlightItems.erase(needItemIds[i]);
					}
				});
			},
			insertItemId: function(itemId) {
				if (handler.count(itemId)) {
					return;
				}
				handler.m_inFlightItems.insert(itemId);
				oscar.getItem(itemId, function(item) {
					if (handler.m_inFlightItems.count(item.id())) {
						handler.insertItem(item);
					}
					handler.m_inFlightItems.erase(itemId);
				});
			},
			insertItem: function(item) {
				if (!handler.hasItem(item.id())) {
					handler._appendItem(item);
					handler.m_itemIds.insert(item.id());
				}
			},
			//return number of inserted items
			insertItems: function(items) {
				var missingItems = [];
				for(var i in items) {
					var itemId = items[i].id();
					if (!handler.hasItem(itemId)) {
						missingItems.push(items[i]);
						handler.m_itemIds.insert(itemId);
					}
				}
				var toInsert = handler._renderItems(missingItems);
				$(toInsert).appendTo(handler.m_domRoot);
				handler._addEventHandlers(handler.m_domRoot);

				return missingItems.length;
			},
			remove: function(itemId) {
				if (handler.m_inFlightItems.count(itemId)) {
					handler.m_inFlightItems.erase(itemId);
					return;
				}
				else if (handler.count(itemId)) {
					handler.close(itemId);
					handler._domItemRoot(itemId).each(function() {
						$(this).remove();
					});
					handler.m_itemIds.erase(itemId);
				}
			},
			//returns number of added+removed items
			assign: function(items) {
				var itemIdSet = tools.SimpleSet();
				for(i in items) {
					itemIdSet.insert(items[i].id());
				}
				var itemsToRemove = [];
				handler.each(function(itemId) {
					if (! itemIdSet.count(itemId) ) {
						itemsToRemove.push(itemId);
					}
				});
				for(var i in itemsToRemove) {
					handler.remove(itemsToRemove[i]);
				}
				return handler.insertItems(items) + itemsToRemove.length;
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
				handler.m_inFlightItems.clear();
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
	
	var InspectionItemListHandler = function(parent, scrollContainer) {
		var ilh = ItemListHandler(parent, scrollContainer);
		ilh._item2RenderData = function(item) {
			return state.resultListTemplateDataFromItem(item, true);
		}
		return ilh;
	};
	
	//handles multiple item lists as tab groups
	//emits multiple signals on it self:
	var ItemListTabHandler = function(parent, scrollContainer) {
		if (scrollContainer === undefined) {
			scrollContainer = parent;
		}
		var handler = {
			m_domRoot : undefined,
			m_domTabRoot : undefined,
			m_scrollContainer: $(scrollContainer),
			//maps from tabId=<int> ->
			//{ handler : ItemListHandler,
			//  tabContentId: <string>,
			//  tabHeadId: <string>,
			//  cells: tools.SimpleSet()
			//}
			m_tabs : tools.SimpleHash(), 
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
			emit_activeTabChanged: function(newTabId) {
				$(handler).triggerHandler({
					type: "activeTabChanged",
					newTabId: newTabId,
					tid: newTabId
				});
			},
			
			_slot_activeTabChanged: function() {
				handler.emit_activeTabChanged(handler.activeTabId());
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
					handler._slot_activeTabChanged();
				});
			},
	   
			//Do not use this except for iterating over all available tabs
			values: function() {
				return handler.m_tabs.values();
			},
	   
			cells: function(tabId) {
				return handler.m_tabs.at(tabId).cells;
			},
			
			///cells must be of type tools.SimpleSet()
			setCells: function(tabId, cells) {
				if (handler.hasTab(tabId)) {
					handler.m_tabs.at(tabId).cells = cells;
				}
			},
	   
			size: function() {
				return handler.m_tabs.size();
			},
			
			domRoot: function() {
				return handler.m_domRoot;
			},
			hasTab: function(tabId) {
				return handler.m_tabs.count(tabId);
			},
			count: function(tabId) {
				return handler.hasTab(tabId);
			},
			itemListHandler: function(tabId) {
				return handler.m_tabs.at(tabId).handler;
			},
			
			//adds a new tab, returns an ItemListHandler, if prepend == true, then the tab will be added as the first element
			addTab: function(tabId, tabName, itemCount, prepend, itemListHandlerCreator) {
				if (handler.m_tabs.count(tabId)) {
					return handler.m_tabs.at(tabId).handler;
				}
				
				if (prepend === undefined) {
					prepend = false;
				}
				if (itemListHandlerCreator === undefined) {
					itemListHandlerCreator = ItemListHandler;
				}
				
				//add a new tab
				var tabHeadId = tools.generateDocumentUniqueId();
				var tabContentId = tools.generateDocumentUniqueId();
				var tabItemCount = "";
				if (itemCount !== undefined && itemCount >= 0) {
					tabItemCount = '&nbsp;<span class="badge">' + itemCount + '</span>';
				}
				var tabHeadHtml = '<li id="' + tabHeadId + '" tabid="' + tabId + '">'
									+ '<a href="#' + tabContentId + '">' + tabName
									+ tabItemCount
									+ '</a></li>';
				var tabContentHtml = '<div id="' + tabContentId + '"></div>';
				if (prepend) {
					$(handler.m_domTabRoot).prepend(tabHeadHtml);
				}
				else {
					$(handler.m_domTabRoot).append(tabHeadHtml);
				}
				$(handler.m_domRoot).append(tabContentHtml);
				var tabContent = $('#' + tabContentId, handler.m_domRoot);
				var itemListHandler = itemListHandlerCreator(tabContent, handler.m_scrollContainer);
				handler.m_tabs.insert(tabId, {
					handler : itemListHandler,
					tabHeadId : tabHeadId,
					tabContentId : tabContentId,
					cells: tools.SimpleSet()
				});
				//take care of the signals emited from the list handler
				$(itemListHandler).on("itemDetailsOpened", function(e) { handler.emit_itemDetailsOpened(e.itemId); });
				$(itemListHandler).on("itemDetailsClosed", function(e) { handler.emit_itemDetailsClosed(e.itemId); });
				$(itemListHandler).on("itemLinkClicked", function(e) { handler.emit_itemLinkClicked(e.itemId); });
				var myActiveTabId = handler.activeTabId();
				handler.refresh();
				if (myActiveTabId !== -1) {
					handler.openTab(myActiveTabId);
				}
				return handler.m_tabs.at(tabId).handler;
			},
			insertItem: function(tabId, item) {
				if (handler.m_tabs.count(tabId)) {
					handler.m_tabs.at(tabId).handler.insertItem(item);
				}
			},
			insertItems: function(tabId, items) {
				if (handler.m_tabs.count(tabId)) {
					handler.m_tabs.at(tabId).handler.insertItems(items);
				}
			},
			assignItems: function(tabId, items) {
				if (handler.m_tabs.count(tabId)) {
					var changed = handler.m_tabs.at(tabId).handler.assign(items);
					if (changed && handler.activeTabId() == tabId) {
						handler.emit_activeTabChanged();
					}
				}
			},
			//removes a tab return true, if removal was successfull
			removeTab: function(tabId) {
				if (handler.m_tabs.count(tabId)) {
					var myActiveTabId = handler.activeTabId();
					var v = handler.m_tabs.at(tabId);
					v.handler.destroy();
					$("#" + v.tabHeadId ).remove();
					$("#" + v.tabContentId ).remove();
					handler.m_tabs.erase(tabId);
					handler.refresh();
					if (tabId !== myActiveTabId && myActiveTabId !== -1) {
						handler.openTab(myActiveTabId);
					}
					//check if this was the last tab we have,
					//since then there will be no new active tab
					if (!handler.size()) {
						handler.emit_activeTabChanged(-1);
					}
					return true;
				}
				return false;
			},
			
			openTab: function(tabId) {
				if (!handler.hasTab(tabId)) {
					return;
				}
				var index = $("#" + handler.m_tabs.at(tabId).tabHeadId).index();
				handler.m_domRoot.tabs("option", "active", index);
			},
				
			activateTab: function(tabId) {
				if (handler.activeTabId() === tabId) {
					handler.emit_activeTabChanged(tabId);
				}
				else {
					handler.openTab(tabId);
				}
			},
			
			openItem: function(itemId) {
				if (!handler.size()) {
					return;
				}
				if (handler.activeTab().hasItem(itemId)) {
					handler.activeTab().open(itemId);
				}
				else {
					for(var i in handler.m_tabs.values()) {
						if (handler.m_tabs.at(i).handler.hasItem(itemId)) {
							handler.openTab(i);
							handler.m_tabs.at(i).handler.open(itemId);
							break;
						}
					}
				}
			},
	   
			activeTabId: function() {
				if (!handler.m_tabs.size()) {
					return -1;
				}
				var index = handler.m_domRoot.tabs("option", "active");
				var li = handler.m_domTabRoot.children().eq(index);
				var tabIdStr = li.attr("tabid");
				var tabId = parseInt(tabIdStr);
				return tabId;
			},
	   
			//return handler of the active tab
			activeTab: function() {
				var tabId = handler.activeTabId();
				if (parseInt(tabId) >= 0) {
					return handler.m_tabs.at(tabId).handler;
				}
				return undefined;
			},
			
			refresh: function () {
				handler.m_domRoot.tabs("refresh");
				handler.m_domRoot.tabs("option", "active", 0);
			},

			clear: function() {
				if (!handler.size()) {
					return;
				}
				for(var i in handler.m_tabs.values()) {
					var info = handler.m_tabs.at(i);
					info.handler.destroy();
					$('#' + info.tabContentId).remove();
					$('#' + info.tabHeadId).remove();
				}
				handler.m_tabs.clear();
				handler.refresh();
				handler.emit_activeTabChanged(-1);
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
		//this only affects layers added AFTER! calling this function
		this.addSignalForward = function(sourceSignalName, mappedSignalName) {
			if (this.m_forwardedSignals[sourceSignalName] !== undefined) {
				if ($.inArray(mappedSignalName, this.m_forwardedSignals[sourceSignalName])) {
					return;
				}
			}
			else {
				this.m_forwardedSignals[sourceSignalName] = [];
			}
			this.m_forwardedSignals[sourceSignalName].push(mappedSignalName);
		},
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
	
	var clusterMarkerOptions = {
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
				for (var i in children) {
					if (children[i].count) {
						count = Math.max(children[i].count, count);
					}
				}
			}

			// only true for real items
			if (cluster.getAllChildMarkers().length == 1 && !cluster.getAllChildMarkers()[0].bbox) {
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
	};
	
	L.MarkerCluster.prototype["getChildClustersNames"] = function () {
		var names = [];
		var allChildClusters = this.getAllChildMarkers();

		for (var i in allChildClusters) {
			if (allChildClusters[i].name != undefined) {
				names.push(allChildClusters[i].name);
			}
		}
		return names;
	};

	L.MarkerCluster.prototype["getChildClustersRegionIds"] = function () {
		var rids = [];
		var allChildClusters = this.getAllChildMarkers();

		for (var i in allChildClusters) {
			if (allChildClusters[i].rid !== undefined) {
				rids.push(allChildClusters[i].rid);
			}
		}
		return rids;
	};

	var WORLD_TAB_ID = 0xFFFFFFFF;
	var INSPECTION_TAB_ID = WORLD_TAB_ID-1;
	
    var map = {
		ItemListHandler: ItemListHandler,
		ItemListTabHandler: ItemListTabHandler,
		ItemShapeHandler: ItemShapeHandler,
		ItemMarkerHandler: ItemMarkerHandler,
		RegionMarkerHandler: RegionMarkerHandler,

		resultListTabs: undefined,
		relativesTab: { activeItemHandler: undefined, relativesHandler: undefined },
		
		//map shapes
		itemShapes: undefined,
		relativesShapes: undefined,
		highlightItemShapes: undefined,
		inspectedItemShapes: undefined,
		clusterMarkerRegionShapes: undefined,
		
		//markers
		itemMarkers: ItemMarkerHandler(state.map),
		inspectedItemMarkers: ItemMarkerHandler(state.map),
		clusterMarkerGroup: undefined,
		clusterMarkers: undefined,
		
		//dag handling
		dagExpander: dagexp.dagExpander(),
		
		//cfg
		cfg: config.map,
		
		locks: {
			mapViewChanged: {locked: false, queued: false}
		},
		
		//this has to be called prior usage
		init: function() {
			map.resultListTabs = map.ItemListTabHandler('#left_menu_parent', '#sidebar-content');
			map.relativesTab.activeItemHandler = map.ItemListHandler($('#activeItemsList'));
			map.relativesTab.relativesHandler = map.ItemListHandler($('#relativesList'));
			
			//init the map layers
			map.itemShapes = map.ItemShapeHandler(state.map, config.styles.shapes.items.normal);
			map.inspectedItemShapes = map.ItemShapeHandler(state.map, config.styles.shapes.items.inspected);
			map.relativesShapes = map.ItemShapeHandler(state.map, config.styles.shapes.relatives.normal);
			map.highlightItemShapes = map.ItemShapeHandler(state.map, config.styles.shapes.activeItems);
			map.clusterMarkerRegionShapes = map.ItemShapeHandler(state.map, config.styles.shapes.regions.highlight);
			
			map.itemMarkers = map.ItemMarkerHandler(state.map);

			//init the cluster markers
            map.clusterMarkerGroup = L.markerClusterGroup(clusterMarkerOptions);
			state.map.addLayer(map.clusterMarkerGroup);
			map.clusterMarkers = map.RegionMarkerHandler(map.clusterMarkerGroup);
			
		},
	   
		_attachEventHandlers: function() {
			$(map.resultListTabs).on("itemLinkClicked", map.onItemLinkClicked);
			$(map.resultListTabs).on("itemDetailsOpened", map.onItemDetailsOpened);
			$(map.resultListTabs).on("itemDetailsClosed", map.onItemDetailsClosed);
			$(map.resultListTabs).on("activeTabChanged", map.onActiveTabChanged);
			
			$(map.itemMarkers).on("click", map.onItemMarkerClicked);
			
			$(map.clusterMarkers).on("click", map.onClusterMarkerClicked);
			$(map.clusterMarkers).on("mouseover", map.onClusterMarkerMouseOver);
			$(map.clusterMarkers).on("mouseout", map.onClusterMarkerMouseOut);
			map.clusterMarkerGroup.on("clusterclick", map.onClusteredClusterMarkerClicked);
			map.clusterMarkerGroup.on("clustermouseover", map.onClusteredClusterMarkerMouseOver);
			map.clusterMarkerGroup.on("clustermouseout", map.onClusteredClusterMarkerMouseOut);
			map.clusterMarkerGroup.on("layerremove", map.onClusterMarkerLayerRemoved);
		},
	   
		_detachEventHandlers: function() {
			$(map.resultListTabs).off("itemLinkClicked", map.onItemLinkClicked);
			$(map.resultListTabs).off("itemDetailsOpened", map.onItemDetailsOpened);
			$(map.resultListTabs).off("itemDetailsClosed", map.onItemDetailsClosed);
			$(map.resultListTabs).off("activeTabChanged", map.onActiveTabChanged);
			
			$(map.itemMarkers).off("click", map.onItemMarkerClicked);
			
			$(map.clusterMarkers).off("click", map.onClusterMarkerClicked);
			$(map.clusterMarkers).off("mouseover", map.onClusterMarkerMouseOver);
			$(map.clusterMarkers).off("mouseout", map.onClusterMarkerMouseOut);
			map.clusterMarkerGroup.off("clusterclick", map.onClusteredClusterMarkerClicked);
			map.clusterMarkerGroup.off("clustermouseover", map.onClusteredClusterMarkerMouseOver);
			map.clusterMarkerGroup.off("clustermouseout", map.onClusteredClusterMarkerMouseOut);
			map.clusterMarkerGroup.off("layerremove", map.onClusterMarkerLayerRemoved);
		},
		
		clear: function() {
			state.map.off("zoomend dragend", map.viewChanged);
			map._detachEventHandlers();
			
			state.dag.clear();

			map.itemShapes.clear();
			map.relativesShapes.clear();
			map.highlightItemShapes.clear();
			map.inspectedItemShapes.clear();
			map.clusterMarkerRegionShapes.clear();
			
			map.itemMarkers.clear();
			map.clusterMarkers.clear();

			map.resultListTabs.clear();
			map.relativesTab.activeItemHandler.clear();
			map.relativesTab.relativesHandler.clear();
			
			map._attachEventHandlers();
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
		},
		
		//panel event handlers
		onItemDetailsOpened: function(e) {
			var itemId = e.itemId;
			map.highlightItemShapes.addWithCallback(itemId, function() {
				if (state.items.activeItem == itemId) {
					map.highlightItemShapes.zoomTo(itemId);
				}
			});
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
			if (map.resultListTabs.activeTabId() >= 0 && map.cfg.resultList.showItemMarkers) {
				wantItemMarkers = map.resultListTabs.activeTab();
			}
			else {
				wantItemMarkers = tools.SimpleSet();
			}
			var removedIds = tools.SimpleSet();
			var missingIds = tools.SimpleSet();
			tools.getMissing(wantItemMarkers, map.itemMarkers, removedIds, missingIds);
			removedIds.each(function(itemId) {
				map.itemMarkers.remove(itemId);
				state.dag.item(itemId).displayState &= ~dag.DisplayStates.HasItemMarker;
			});
			if (missingIds.size()) {
				oscar.fetchShapes(missingIds.toArray(), function() {}, tools.defErrorCB);
			}
			missingIds.each(function(itemId) {
				map.itemMarkers.add(itemId);
			});
			//mark dag nodes accordingly
			var tmp = map.itemMarkers.values();
			for(var itemId in tmp) {
				state.dag.item(itemId).displayState |= dag.DisplayStates.HasItemMarker;
			}
			
			if (map.resultListTabs.size() && map.cfg.resultList.showItemShapes) {
				wantItemMarkers = map.resultListTabs.activeTab();
				var removedIds = tools.SimpleSet();
				var missingIds = tools.SimpleSet();
				tools.getMissing(wantItemMarkers, map.itemShapes, removedIds, missingIds);
				removedIds.each(function(itemId) {
					map.itemShapes.remove(itemId);
				});
				if (missingIds.size()) {
					oscar.fetchShapes(missingIds.toArray(), function() {}, tools.defErrorCB);
				}
				missingIds.each(function(itemId) {
					map.itemShapes.add(itemId);
				});
			}
			else {
				map.itemShapes.clear();
			}
			
		},
		
		onItemMarkerClicked: function(e) {
			state.items.activeItem = e.itemId;
			map.resultListTabs.openItem(e.itemId);
			map.resultListTabs.activeTab().scrollTo(e.itemId);
			map.showItemRelatives();
		},
		onClusterMarkerLayerRemoved: function(e) {
			map.closePopups();
			map.clusterMarkerRegionShapes.clear();
		},
		onClusterMarkerClicked: function(e) {
			map.closePopups();
			map.clusterMarkers.remove(e.itemId);
			map.zoomTo(e.itemId);
			if (!state.dag.region(e.itemId).isLeaf) {
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
				.setContent(e.itemId + ":" + marker.name).openOn(state.map);
		},
		onClusteredClusterMarkerClicked: function (e) {
			e.layer.zoomToBounds();
		},
		onClusterMarkerMouseOut: function(e) {
			map.closePopups();
			map.clusterMarkerRegionShapes.clear();
		},
		onClusteredClusterMarkerMouseOut: function(e) {
			map.closePopups();
			map.clusterMarkerRegionShapes.clear();
		},
		onClusteredClusterMarkerMouseOver: function(e) {
			var target = e.layer;
			if (target.getChildCount() > 1 && target.getChildCount() <= config.maxNumSubClusters && map.cfg.clusterShapes.display) {
				var childRids = target.getChildClustersRegionIds();
				oscar.fetchShapes(childRids, function() {}, tools.defErrorCB);
				for(var i in childRids) {
					map.clusterMarkerRegionShapes.add(childRids[i]);
				}
			}
			var names = target.getChildClustersNames();
			var text = "";
			if (names.length > 0) {
				for (var i in names) {
					if(i > config.maxNumSubClusters){
						text += "...";
						break;
					}
					text += names[i];
					if (i < names.length - 1) {
						text += ", ";
					}
				}
				L.popup({offset: new L.Point(0, -10)}).setLatLng(e.latlng).setContent(text).openOn(state.map);
			}
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
	   
		//this is a recursive function, you have to clear the displayState of the dag before calling
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
// 						if (!childNode.cells.size() && childNode.mayHaveItems) {
// 							cellsToFetch.insert(childNode.id);
// 						}
					}
					else if (myOverlap > config.clusters.shapeOverlap &&
							oscar.shapeCache.count(childNode.id) &&
							oscar.intersect(state.map.getBounds(), oscar.shapeCache.at(childNode.id)))
					{
						map.updateDag(childNode, childrenToFetch, cellsToFetch);
						childNode.displayState |= dag.DisplayStates.InResultsTab;
// 						if (!childNode.cells.size() && childNode.mayHaveItems) {
// 							cellsToFetch.insert(childNode.id);
// 						}
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
				if (!node.cells.size() && node.mayHaveItems) {
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
		
		expandRegion: function(parentId, cb) {
			map.dagExpander.expandRegionChildren(parentId, cb);
		},
		
		mapViewChanged: function() {
			//this should remove those awfull long stacks
			setTimeout(function() {
				map._mapViewChanged();
			}, 0);
		},
		
		//function to calculate the dag state from our current mapview
		_dagStateFromMapView: function() {
			var cbh;
			var childrenToFetch = tools.SimpleSet();
			var cellsToFetch = tools.SimpleSet();
			
			state.dag.clearDisplayState();
			
			map.updateDag(state.dag.region(0xFFFFFFFF), childrenToFetch, cellsToFetch);
			
			//get the children and the cells of regions that expand their cells
			if (childrenToFetch.size() || cellsToFetch.size()) {
				cbh = tools.AsyncCallBackHandler(2, function() {
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
			//bottom-up traversal makes sure that only the lowest region will get a tab
			var currentMapBounds = state.map.getBounds();
			var maxOverlap = 0.0;
			var maxOverlapRegionId = -1;
			state.dag.bottomUp(state.dag.region(0xFFFFFFFF), function(node) {
				if (node.displayState & dag.DisplayStates.InResultsTab) {
					var ok = false;
					var hasMaxOverlapCell = false;
					for(var cellId in node.cells.values()) {
						var cellNode = state.dag.cell(cellId);
						var ds = cellNode.displayState & (dag.DisplayStates.HasClusterMarker | dag.DisplayStates.InResultsTab2);
						var xMap = currentMapBounds.intersects(cellNode.bbox);
						var pOv = tools.percentOfOverlap(state.map, cellNode.bbox);
						if (ds === 0 && xMap
							&& pOv >= config.clusters.shapeOverlap)
						{
							ok = true;
							cellNode.displayState |= dag.DisplayStates.InResultsTab2;
							if (pOv > maxOverlap) {
								maxOverlap = pOv;
								hasMaxOverlapCell = true;
							}
						}
						cellNode.displayState &= ~dag.DisplayStates.InResultsTab;
					}
					//no cell is marked for this region
					if (!ok) {
						node.displayState &= ~dag.DisplayStates.InResultsTab;
						//no cell is marked for this region this either means that all 
						//cells were used by other regions or the cells are too small to be displayed
						//if the former is the case then everything is fine
						//but in the later case we should add a cluster marker for this region
						ok = !node.cells.size();
						for(var cellId in node.cells.values()) {
							var cellNode = state.dag.cell(cellId);
							var ds = cellNode.displayState & (dag.DisplayStates.HasClusterMarker | dag.DisplayStates.InResultsTab2);
							ok = ok || ds;
						}
						if (!ok) { //no cell is covered by a tab or a cluster marker, so we add one
							node.displayState |= dag.DisplayStates.HasClusterMarker;
							for(var cellId in node.cells.values()) {
								var cellNode = state.dag.cell(cellId);
								cellNode.displayState |= dag.DisplayStates.HasClusterMarker;
							}
						}
					}
					//this region has the cell with maximum overlap
					else if (ok && hasMaxOverlapCell) {
						maxOverlapRegionId = node.id;
					}
				}
			}, dag.NodeTypes.Region);
			
			//reset the cell display states to the original values
			state.dag.each(function(node) {
				if (node.displayState & dag.DisplayStates.InResultsTab) {
					for(var cellId in node.cells.values()) {
						var cellNode = state.dag.cell(cellId);
						if (cellNode.displayState & dag.DisplayStates.InResultsTab2) {
							cellNode.displayState = dag.DisplayStates.InResultsTab;
						}
					}
				}
			}, dag.NodeTypes.Region);
			
			//cells now hold the correct display state (either InResultsTab or HasClusterMarker)
			//regions now hold the correct display state as well
		},
		_assignClusterMarkers: function(wantClusterMarkers) {
			var removedClusterMarkers = tools.SimpleSet();
			var missingClusterMarkers = tools.SimpleSet();
			tools.getMissing(wantClusterMarkers, map.clusterMarkers, removedClusterMarkers, missingClusterMarkers);
		
			removedClusterMarkers.each(function(key) {
				map.clusterMarkers.remove(key);
			});
			missingClusterMarkers.each(function(key) {
				map.clusterMarkers.add(key, state.dag.region(key).count);
			});
		},
		//cells are tools.SimpleSet
		_assignTabContentFromRegion: function(cells, regionId, focusAfterLoad) {
			var removedCells = tools.SimpleSet();
			var missingCells = tools.SimpleSet();
			tools.getMissing(cells, map.resultListTabs.cells(regionId), removedCells, missingCells);
			//nothing to change
			if (!missingCells.size() && !removedCells.size()) {
				if (focusAfterLoad) {
					map.resultListTabs.activateTab(regionId);
				}
				return;
			}
			map.resultListTabs.setCells(regionId, cells);
			
			map.topKItems(map.cfg.resultList.bulkItemFetchCount, 0, cells.toArray(), function(itemIds) {
				//this should return instantly since the items are in the cache
				oscar.getItems(itemIds, function(items) {
					console.assert(itemIds.length == items.length);
					if (!map.resultListTabs.count(regionId) || !cells.equal(map.resultListTabs.cells(regionId))) {
						return;
					}
					map.resultListTabs.assignItems(regionId, items);
					if (focusAfterLoad) {
						map.resultListTabs.activateTab(regionId);
					}
				});
			});
		},
		
	   //@param wantTabListRegions tools.SimpleSet
		_assignTabs: function(wantTabListRegions, maxOverlapRegionId) {
			//only add the world tab if there are other tabs
			if (wantTabListRegions.size()) {
				if (!map.resultListTabs.count(0xFFFFFFFF)) {
					var rn = state.dag.region(0xFFFFFFFF);
					map.resultListTabs.addTab(0xFFFFFFFF, rn.name, rn.count, true);
				}
				wantTabListRegions.insert(0xFFFFFFFF);
			}
			else { //check if we need to remove some tabs
				//inspection tab is there, so we have to remove the other tabs explicitly
				if (!map.cfg.resultList.regionTabs && map.resultListTabs.count(INSPECTION_TAB_ID)) {
					var tabs2Remove = [];
					for(var tabId in map.resultListTabs.values()) {
						if (tabId != INSPECTION_TAB_ID) {
							tabs2Remove.push(tabId);
						}
					}
					for(var i in tabs2Remove) {
						map.resultListTabs.removeTab(tabs2Remove[i]);
					}
				}
				else {
					map.resultListTabs.clear();
				}
				return;
			}
			
			var worldCells = tools.SimpleSet();
			
			//make sure that the active region tab stays the same if it was set before
			if (wantTabListRegions.count( map.resultListTabs.activeTabId() )) {
				maxOverlapRegionId = map.resultListTabs.activeTabId();
			}
			else if (!map.cfg.resultList.focusMaxOverlapTab) {
				maxOverlapRegionId = 0xFFFFFFFF;
			}
			
			if (map.cfg.resultList.regionTabs) {
				var removedTabs = [];
				for(var tabId in map.resultListTabs.values()) {
					if (!wantTabListRegions.count(tabId)) {
						removedTabs.push(tabId);
					}
				}
				for(var i in removedTabs) {
					map.resultListTabs.removeTab(removedTabs[i]);
				}
			}

			wantTabListRegions.each(function(regionId) {
				if (parseInt(regionId) === 0xFFFFFFFF) {
					return;
				}
				if (map.cfg.resultList.regionTabs) {
					var wantCells = tools.SimpleSet();
					state.dag.region(regionId).cells.each(function(cellId) {
						if (state.dag.cell(cellId).displayState & dag.DisplayStates.InResultsTab) {
							worldCells.insert(cellId);
							wantCells.insert(cellId);
						}
					});
					if (!map.resultListTabs.count(regionId)) {
						var rn = state.dag.region(regionId);
						map.resultListTabs.addTab(regionId, rn.name, rn.count);
					}
					map._assignTabContentFromRegion(wantCells, regionId, parseInt(regionId) == maxOverlapRegionId);
				}
				else {
					state.dag.region(regionId).cells.each(function(cellId) {
						if (state.dag.cell(cellId).displayState & dag.DisplayStates.InResultsTab) {
							worldCells.insert(cellId);
						}
					});
				}
			});

			if (worldCells.size()) {
				map._assignTabContentFromRegion(worldCells, 0xFFFFFFFF, maxOverlapRegionId === WORLD_TAB_ID);
			}
		},
		
		_mapViewChanged: function() {
			if (map.locks.mapViewChanged.locked) {
				map.locks.mapViewChanged.queued = true;
				return;
			}
			map.locks.mapViewChanged.locked = true;
			
			var timers = {
				complete: tools.timer("mapViewChanged::complete"),
				updateDag: tools.timer("mapViewChanged::updateDag"),
				clusterUpdate: tools.timer("mapViewChanged::clusterUpdate"),
				tabUpdate: tools.timer("mapViewChanged::tabUpdate")
			};
			
			map.closePopups();
			
			
			timers.updateDag.start();
			{
				map._dagStateFromMapView();
			}
			timers.updateDag.stop();

			
			//the dag now holds the state the gui should have
			//let's get them synchronized
			//recycle as many markers, tabs etc. as possible
			//remove disabled markers/tabs etc
			//add new markers/tabs etc.

			var wantTabListRegions = tools.SimpleSet();
			var wantClusterMarkers = tools.SimpleSet();
			state.dag.each(function(node) {
				if (node.displayState & dag.DisplayStates.HasClusterMarker) {
					wantClusterMarkers.insert(node.id);
				}
				if (node.displayState & dag.DisplayStates.InResultsTab) {
					wantTabListRegions.insert(node.id);
				}
			}, dag.NodeTypes.Region);
			
			timers.clusterUpdate.start();
			{
				map._assignClusterMarkers(wantClusterMarkers);
			}
			timers.clusterUpdate.stop();
			
			timers.tabUpdate.start();
			{
				map._assignTabs(wantTabListRegions);
			}
			timers.tabUpdate.stop();

			timers.complete.stop();
			if (map.locks.mapViewChanged.queued) {
				//this is guaranteed to be running before any other call to mapViewChanged
				//due to the lock that is NOT released yet
				setTimeout(function() {
					map.locks.mapViewChanged.locked = false;
					map.locks.mapViewChanged.queued = false;
					map.mapViewChanged();
				}, 0);
			}
			else {
				map.locks.mapViewChanged.locked = false;
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
// 	var tileURI = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	var tileURI = 'http://tiles.fmi.uni-stuttgart.de/planet/{z}/{x}/{y}.png'
	L.tileLayer(tileURI, {attribution: osmAttr, maxZoom: 20}).addTo(state.map);
	
	//init map module
	map.init();

	return map;
});