define(["jquery", "tools", "state", "spinner", "oscar", "dag", "storage"], function ($, tools, state, spinner, oscar, dag, storage) {
	var regionChildrenExpander = storage.IndexedDataStore();
	
	regionChildrenExpander.m_cfg = {
		preloadShapes : true,
		loadChildrenCells: false,
		loadParentCells: true,
		regionExclusiveCells: true
	},
	
	//data is:
	//{ childrenInfo: {<childId> : { apxitems: <int>, name: name, bbox: bbox, clusterHint: hint, cells: [cellId]} }, parentInfo: {cells: []} }
	regionChildrenExpander.m_data = {
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
	// data is {
	//    graph: { regionId: [childId]},
	//    cells: { regionId: [cellId] },
	//    regionInfo: { regionId: { apxitems: <int>, clusterHint: [[]], name: <string>, bbox: [[]] }}
	// }
	regionChildrenExpander._insertData = function(dataIds, data) {
		//data is the same as the one retrieved by _getData
		//Item information is added
		
		//first take care of the children nodes
		//then add the edges
		//then take care of the cells
		var regionInfo = data["regionInfo"];
		for(var regionId in regionInfo) {
			regionId = parseInt(regionId);
			if (state.dag.hasRegion(regionId)) {
				continue;
			}
			var ci = regionInfo[regionId];
			var node = state.dag.addNode(regionId, dag.NodeTypes.Region);
			node.count = ci["apxitems"];
			node.name = ci["name"];
			node.bbox = ci["bbox"];
			node.isLeaf = ci["leaf"]; //either undefined, which is ok as well
			node.clusterHint = ci["clusterHint"];
		}
		
		var graph = data["graph"];
		for (let parentId of dataIds) {
			var parentNode = state.dag.region(parentId);
			
			if (graph[parentId] === undefined || !graph[parentId].length) {
				parentNode.isLeaf = true;
				continue;
			}
			
			var children = graph[parentId];
			for(var i in children) {
				var childNode = state.dag.region(children[i]);
				state.dag.addEdge(parentNode, childNode);
			}
		}
		
		var cellInfo = data["cells"];
		for(var regionId in cellInfo) {
			regionId = parseInt(regionId);
			var regionNode = state.dag.region(regionId);
			var cells = cellInfo[regionId];
			if (cells !== undefined && !cells.length) {
				regionNode.mayHaveItems = false;
			}
			for(var i in cells) {
				var cellId = cells[i];
				var cellNode;
				if (state.dag.hasCell(cellId)) {
					cellNode = state.dag.cell(cellId);
				}
				else {
					cellNode = state.dag.addNode(cellId, dag.NodeTypes.Cell);
					cellNode.bbox = oscar.cellInfoCache.at(cellId);
					var tmp = [[cellNode.bbox[0], cellNode.bbox[2]], [cellNode.bbox[1], cellNode.bbox[3]]];
					cellNode.bbox = tmp;
				}
				state.dag.addEdge(regionNode, cellNode);
			}
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
		
		var mySecondStage = function(result, childIds, cellIds) {

			var myFinishCount = 0;
			var myFinish = function() {
				++myFinishCount;
				if (myFinishCount === 2) {
					cb(result, remoteRequestId);
				}
			};

			//cache the shapes
			if (me.m_cfg.preloadShapes) {
				oscar.fetchShapes(childIds, function() {});
			}
			
			if (cellIds.length) {
				oscar.fetchCellInfo(cellIds, function() {
					myFinish();
				}, tools.defErrorCB);
			}
			else {
				myFinish();
			}
			
			//now get the item info for the name and the bbox
			oscar.getItems(childIds,
				function (items) {
					console.assert(items.length == childIds.length);
					var regionInfo = result["regionInfo"];
					for(let item of items) {
						var ri = regionInfo[item.id()];
						ri["name"] = item.name();
						ri["bbox"] = item.bbox();
					}
					myFinish();
				}
			);
		};
		// result is of the form
		// { graph: { regionId: [childId]}, cells: { regionId: [cellId] }, regionInfo: { regionId: { apxitems: <int>, clusterHint}} }
		state.cqr.multiRegionChildrenInfo(parentIds, function(result) {
			var children = [];
			var cells = [];
			var regionInfo = result["regionInfo"];
			for(var regionId in regionInfo) {
				children.push(parseInt(regionId));
			}
			if (result["cells"] !== undefined) {
				var rc = result["cells"];
				var tmp = tools.SimpleSet();
				for(var regionId in rc) {
					var rci = rc[regionId]; //this is the array
					for(var i in rci) {
						tmp.insert(rci[i]);
					}
				}
				cells = tmp.toArray();
			}
			mySecondStage(result, children, cells);
		}, tools.defErrorCB, true, this.m_cfg.loadChildrenCells, this.m_cfg.loadParentCells, this.m_cfg.regionExclusiveCells);
	};
	
	var regionCellExpander = storage.IndexedDataStore();
	//cellInfo is { cellId: bbox }
	regionCellExpander.m_data = {
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
	//data is of the form: { regionId: [cellId] }
	regionCellExpander._insertData = function(dataIds, data) {
		for(let regionId of dataIds) {
			var regionNode = state.dag.region(regionId);
			var cells = data[regionId];
			if (cells === undefined || cells.length === 0) {
				regionNode.mayHaveItems = false;
				continue;
			}
			for(let cellId of cells) {
				var cellNode;
				if (state.dag.hasCell(cellId)) {
					cellNode = state.dag.cell(cellId);
				}
				else {
					cellNode = state.dag.addNode(cellId, dag.NodeTypes.Cell);
					cellNode.bbox = oscar.cellInfoCache.at(cellId);
					var tmp = [[cellNode.bbox[0], cellNode.bbox[2]], [cellNode.bbox[1], cellNode.bbox[3]]];
					cellNode.bbox = tmp;
				}
				state.dag.addEdge(regionNode, cellNode);
			}
		}
	},
	regionCellExpander._getData = function(cb, remoteRequestId) {
		var parentIds = this._remoteRequestDataIds(remoteRequestId);
		state.cqr.cells(parentIds, function(result) {
			//result is of the form { regionId: [cellId] }
			var tmp = tools.SimpleSet();
			for(var regionId in result) {
				for(let cellId of result[regionId]) {
					tmp.insert(cellId);
				}
			}
			oscar.fetchCellInfo(tmp.toArray(), function() {
				cb(result, remoteRequestId);
			}, tools.defErrorCB);
		}, tools.defErrorCB, true);
	};
	
	var cellItemExpander = storage.IndexedDataStore();
	
	cellItemExpander.m_cfg = {
		maxFetchCount: 10
	};
	//itemInfo is a simple array {itemId: {name: <string>, bbox: <bbox>}}
	cellItemExpander.m_data = {
		insert: function(cellId, itemsInfo) {
			var cellNode = state.dag.cell(cellId);
			for(var itemId in itemsInfo) {
				itemId = parseInt(itemId);
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
				for(let itemId of cellItemIds) {
					if (!state.dag.hasItem(itemId) ) {
						missingItemInfo.insert(itemId);
					}
				}
			}
			oscar.getItems(missingItemInfo.toArray(), function(items) {
				var tmp = {};
				for(let item of items) {
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
							for (let item of items) {
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
							for(let childId of children) {
								state.dag.addEdge(state.dag.region(regionId), state.dag.region(childId));
							}
						}
						else {
							state.dag.region(regionId).isLeaf = true;
						}
					}

					for (let childId of subSet.rootchildren) {
						state.dag.addEdge(state.dag.region(0xFFFFFFFF), state.dag.region(childId));
					}
					myCB();
				}

				state.cqr.getDag(subSetHandler, tools.defErrorCB);
			},
			
			//if cb is called, all relevant items should be in the cache
			//items2FetchPerCell is currently unsupported
			expandCellItems: function(cellIds, cb, items2FetchPerCell) {
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
