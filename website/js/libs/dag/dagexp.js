define(["jquery", "tools", "state", "spinner", "oscar", "dag"], function ($, tools, state, spinner, oscar, dag) {
	var regionChildrenExpander = oscar.IndexedDataStore();
	
	regionChildrenExpander.m_cfg = {
		preloadShapes : true,
	},
	
	//childrenInfo is:
	//{ <childId> : { apxitems: <int>, name: name, bbox: bbox, clusterHint: hint}
	regionChildrenExpander.m_data = {
		insert: function(parentId, childrenInfo) {
			var parentNode = state.dag.region(parentId);
			for(var childId in childrenInfo) {
				var childNode;
				if (state.dag.hasRegion(childId)) {
					childNode = state.dag.region(childId);
				}
				else {
					childNode = state.dag.addNode(childId, dag.NodeTypes.Region);
					var ci = childrenInfo[childId];
					childNode.count = ci["apxitems"];
					childNode.name = ci["name"];
					childNode.bbox = ci["bbox"];
					childNode.isLeaf = ci["leaf"]; //either undefined, which is ok as well
					childNode.clusterHint = ci["clusterHint"];
				}
				state.dag.addEdge(parentNode, childNode);
			}
			if ($.isEmptyObject(childrenInfo)) {
				parentNode.isLeaf = true;
			}
		},
		size: function() {
			return state.dag.regionSize();
		},
		count: function(id) {
			if (!state.dag.hasRegion(id)) {
				return false;
			}
			var node = state.dag.region(id);
			return node.isLeaf || node.children.size();
		},
		at: function(id) {
			console.assert(false, "Should never be called");
			return;
		}
	};
	//fetching stuff from store is not necessary,
	//we only call the cb to tell that we're done
	regionChildrenExpander._requestFromStore = function(cb, parentIds) {
		cb();
	};
	regionChildrenExpander._getData = function(cb, remoteRequestId) {
		var parentIds = this._remoteRequestDataIds(remoteRequestId);
		var me = this;
		var myFinish = function(result, allChildIds) {
			//cache the shapes
			if (me.m_cfg.preloadShapes) {
				oscar.fetchShapes(allChildIds, function() {});
			}
			
			//now get the item info for the name and the bbox
			oscar.getItems(allChildIds,
				function (items) {
					console.assert(items.length == allChildIds.length);
					var tmp = {};
					for (var i in items) {
						var item = items[i];
						tmp[item.id()] = { name: item.name(), bbox: item.bbox()};
					}
					for(var regionId in result) {
						var ri = result[regionId];
						for(var childId in ri) {
							var ci = ri[childId];
							ci["name"] = tmp[childId]["name"];
							ci["bbox"] = tmp[childId]["bbox"];
						}
					}
					cb(result, remoteRequestId);
				}
			);
		};
		// result is of the form
		// regionId -> { childId -> {apxitems : <int>, cells: [], name: <string>, bbox: <bbox>, clusterHint: <hint>} }
		//don't fetch cells! cells are fetched by reigonCellExpander
		state.cqr.multiRegionChildrenInfo(parentIds, function(result) {
			var children = tools.SimpleSet();
			for(var regionId in result) {
				for(var childId in result[regionId]) {
					children.insert(childId);
				}
			}
			myFinish(result, children.toArray());
		}, tools.defErrorCB, false, true);
	};
	
	var regionCellExpander = oscar.IndexedDataStore();
	//cellInfo is { cellId: bbox }
	regionCellExpander.m_data = {
		insert: function(parentId, cellInfo) {
			var parentNode = state.dag.region(parentId);
			for(var cellId in cellInfo) {
				var childNode;
				if (state.dag.hasCell(cellId)) {
					childNode = state.dag.cell(cellId);
				}
				else {
					childNode = state.dag.addNode(cellId, dag.NodeTypes.Cell);
					childNode.bbox = cellInfo[cellId];
					var tmp = [[childNode.bbox[0], childNode.bbox[2]], [childNode.bbox[1], childNode.bbox[3]]];
					childNode.bbox = tmp;
				}
				state.dag.addEdge(parentNode, childNode);
			}
			if ($.isEmptyObject(cellInfo)) {
				parentNode.mayHaveItems = false;
			}
		},
		size: function() {
			return state.dag.regionSize();
		},
		count: function(id) {
			if (!state.dag.hasRegion(id)) {
				return false;
			}
			var node = state.dag.region(id);
			return node.cells.size() || !node.mayHaveItems;
		},
		at: function(id) {
			console.assert(false, "Should never be called");
			return;
		}
	};
	//fetching stuff from store is not necessary,
	//we only call the cb to tell that we're done
	regionCellExpander._requestFromStore = function(cb, parentIds) {
		cb();
	};
	regionCellExpander._getData = function(cb, remoteRequestId) {
		var parentIds = this._remoteRequestDataIds(remoteRequestId);
		var result = {}; // parentId -> { cellId: bbox }
		var resultSize = 0;
		
		var myFinish = function() {
			
			var missingCellInfo = tools.SimpleSet();
			
			//the cells nodes are now in the dag
			//let's get the bbox of cells that don't have one
			var cellIds = [];
			for(var regionId in result) {
				var ri = result[regionId];
				for(var cellId in ri) {
					if (!state.dag.hasCell(cellId)) {
						missingCellInfo.insert(cellId);
					}
					else {
						console.assert(state.dag.cell(cellId).bbox !== undefined);
					}
				}
			}
			var missingCellInfo = missingCellInfo.toArray();
			//cellInfo is of the form [[bounds]]
			oscar.getCellInfo(missingCellInfo, function(cellInfo) {
				var tmp = {};
				for(var i in missingCellInfo) {
					tmp[missingCellInfo[i]] = cellInfo[i];
				}
				
				for(var regionId in result) {
					var ri = result[regionId];
					for(var cellId in ri) {
						ri[cellId] = tmp[cellId]; //automatically sets existing cells to undefined
					}
				}
				
				cb(result, remoteRequestId);
			}, tools.defErrorCB);
		};
		
		var myWrapper = function(parentId) {
			state.cqr.getRegionExclusiveCells(parentId, function(cellInfo) {
				var tmp = {};
				for(var i in cellInfo) {
					tmp[cellInfo[i]] = undefined;
				}
				resultSize += 1;
				result[parentId] = tmp;
				if (resultSize == parentIds.length) {
					myFinish();
				}
			}, tools.defErrorCB);
		};
		
		for(var i in parentIds) {
			myWrapper(parentIds[i]);
		}
	};
	
	var cellItemExpander = oscar.IndexedDataStore();
	
	cellItemExpander.m_cfg = {
		maxFetchCount: 10
	};
	//itemInfo is a simple array {itemId: {name: <string>, bbox: <bbox>}}
	cellItemExpander.m_data = {
		insert: function(cellId, itemsInfo) {
			var cellNode = state.dag.cell(cellId);
			for(var itemId in itemsInfo) {
				var childNode;
				if (state.dag.hasItem(itemId)) {
					childNode = state.dag.item(itemId);
				}
				else {
					childNode = state.dag.addNode(itemId, dag.NodeTypes.Item);
					var itemInfo = itemsInfo[itemId];
					childNode.name = itemInfo["name"];
					childNode.bbox = itemInfo["bbox"];
				}
				state.dag.addEdge(cellNode, childNode);
			}
		},
		size: function() {
			return state.dag.cellSize();
		},
		count: function(id) {
			if (!state.dag.hasCell(id)) {
				return false;
			}
			var node = state.dag.cell(id);
			return node.items.size();
		},
		at: function(id) {
			console.assert(false, "Should never be called");
			return;
		}
	};
	//fetching stuff from store is not necessary,
	//we only call the cb to tell that we're done
	cellItemExpander._requestFromStore = function(cb, cellIds) {
		cb();
	};
	cellItemExpander._getData = function(cb, remoteRequestId) {
		var cellIds = this._remoteRequestDataIds(remoteRequestId);
		
		//cellInfo is of the form {cellId: [itemId]}
		state.cqr.getCellItems(cellIds, function(cellInfo) {

			var missingItemInfo = tools.SimpleSet();
			for(var cellId in cellInfo) {
				var cellItemIds = cellInfo[cellId];
				for(var i in cellItemIds) {
					var itemId = cellItemIds[i];
					if (!state.dag.hasItem(itemId) ) {
						missingItemInfo.insert(itemId);
					}
				}
			}
			oscar.getItems(missingItemInfo.toArray(), function(items) {
				var tmp = {};
				for(var i in items) {
					var item = items[i];
					tmp[item.id()] = item;
				}
				var res = {};
				for(var cellId in cellInfo) {
					res[cellId] = {};
					var ci = cellInfo[cellId];
					var rci = res[cellId];
					for(var i in ci) {
						var itemId = ci[i];
						rci[itemId] = {};
						var ri = rci[itemId];
						if (tmp[itemId] !== undefined) {
							var item = tmp[itemId];
							ri["name"] = item.name();
							ri["bbox"] = item.bbox();
						}
					}
				}
				
				cb(res, remoteRequestId);
			}, tools.defErrorCB);
		}, tools.defErrorCB);
	};

	var dagExpander = function() {
		return {
			regionChildrenExpander: regionChildrenExpander,
			regionCellExpander: regionCellExpander,
			cellItemExpander: cellItemExpander,
	   
			preloadShapes: function()  {
				return this.regionChildrenExpander.m_cfg.preloadShapes ;
			},
	   
			setPreloadShapes: function(value) {
				this.regionChildrenExpander.m_cfg.preloadShapes = value;
			},
	   
			bulkItemFetchCount: function() {
				return this.cellItemExpander.m_cfg.bulkItemFetchCount 
			},
	   
			setBulkItemFetchCount: function(value) {
				this.cellItemExpander.m_cfg.bulkItemFetchCount = value;
			},
	   
			loadAll: function(cb) {
				var myCBCount = 0;
				var myCB = function() {
					myCBCount += 1;
					if (myCBCount < 3) {
						return;
					}
					cb();
				}
				
				function subSetHandler(subSet) {
					var regions = [];
					for (var regionId in subSet.regions) {
						if (!state.dag.hasRegion(regionId)) {
							regions.push(parseInt(regionId));
							state.dag.addNode(regionId, dag.NodeTypes.Region);
						}
					}
					//don't cache shapes here! there may be a lot of shapes!
					
					//get the cluster hints
					state.cqr.clusterHints(regions, function(hints) {
						for(var regionId in hints) {
							console.assert(state.dag.hasRegion(regionId));
							state.dag.region(regionId).clusterHint = hints[regionId];
						}
						myCB();
					});
					
					//fetch the item info
					oscar.getItems(regions,
						function (items) {
							for (var i in items) {
								var item = items[i];
								var node = state.dag.region(item.id());
								node.name = item.name();
								node.bbox = item.bbox();
							}
							myCB();
						},
						function(p1, p2) {
							tools.defErrorCB(p1, p2);
							myCB();
						}
					);
					
					for (var regionId in subSet.regions) {
						state.dag.region(regionId).count = subSet.regions[regionId].apxitems;
						var children = subSet.regions[regionId].children;
						if (children.length) {
							for (var i in children) {
								state.dag.addEdge(state.dag.region(regionId), state.dag.region(children[i]));
							}
						}
						else {
							state.dag.region(regionId).isLeaf = true;
						}
					}

					for (var j in subSet.rootchildren) {
						state.dag.addEdge(state.dag.region(0xFFFFFFFF), state.dag.region(subSet.rootchildren[j]));
					}
					myCB();
				}

				state.cqr.getDag(subSetHandler, tools.defErrorCB);
			},
			
			//if cb is called, all relevant items should be in the cache
			//offset is currently unsupported
			expandCellItems: function(cellIds, cb, offset) {
				spinner.startLoadingSpinner();
				if (! $.isArray(cellIds) ) {
					cellIds = [cellIds];
				}
				this.cellItemExpander.fetch(function() {
					spinner.endLoadingSpinner();
					cb();
				}, cellIds);
			},

			expandRegionCells: function(regionIds, cb) {
				if (! $.isArray(regionIds) ) {
					regionIds = [regionIds];
				}
				spinner.startLoadingSpinner();
				this.regionCellExpander.fetch(function() {
					spinner.endLoadingSpinner();
					cb();
				}, regionIds);
			},
	   
			expandRegionChildren: function(regionIds, cb) {
				if (! $.isArray(regionIds) ) {
					regionIds = [regionIds];
				}
				spinner.startLoadingSpinner();
				this.regionChildrenExpander.fetch(function() {
					spinner.endLoadingSpinner();
					cb();
				}, regionIds);
			}
		}
	};
	
	return {
		dagExpander: function() {
			return dagExpander();
		}
	};
});
