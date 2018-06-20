define(["jquery", "tools", "state", "oscar", "dag", "storage"], function ($, tools, state, oscar, dag, storage) {
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
			parentId = parseInt(parentId)
			var parentNode = state.dag.region(parentId);
			
			if (graph[parentId] === undefined || !graph[parentId].length) {
				parentNode.isLeaf = true;
				continue;
			}
			
			var children = graph[parentId];
			for(var i in children) {
				let childId = parseInt(children[i]);
				var childNode = state.dag.region(childId);
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
				var cellId = parseInt(cells[i]);
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
				cellId = parseInt(cellId);
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
				regionId = parseInt(regionId);
				for(let cellId of result[regionId]) {
					cellId = parseInt(cellId);
					tmp.insert(cellId);
				}
			}
			oscar.fetchCellInfo(tmp.toArray(), function() {
				cb(result, remoteRequestId);
			}, tools.defErrorCB);
		}, tools.defErrorCB, true);
	};
	
	//BEGIN:cellDataFetcher
	var cellDataFetcher = storage.IndexedDataStore();
	//cellInfo is { cellId: bbox }
	cellDataFetcher.m_data = {
		size: function() {
			return state.dag.cellSize();
		},
		count: function(id) {
			if (!state.dag.hasCell(id)) {
				return false;
			}
			var node = state.dag.cell(id);
			return node.count !== undefined;
		},
		at: function(id) {
			console.assert(false, "Should never be called");
			return;
		}
	};
	//fetching stuff from store is not necessary,
	//we only call the cb to tell that we're done
	cellDataFetcher._requestFromStore = function(cb, parentIds) {
		cb();
	};
	//data is of the form: { cellId: {'s':<int>} }
	cellDataFetcher._insertData = function(dataIds, data) {
		for(let cellId of dataIds) {
			console.assert(state.dag.hasCell(cellIds));
			var cellNode = state.dag.cell(cellId);
			console.assert(data[cellId] !== undefined);
			cellNode.count = parseInt( data[cellId]['s'] );
		}
	},
	cellDataFetcher._getData = function(cb, remoteRequestId) {
		var cellIds = this._remoteRequestDataIds(remoteRequestId);
		state.cqr.cellData(cellIds, cb, tools.defErrorCB);
	};
	
	//END:cellDataFetcher
	
	
	///The storage for cell information
	///The item list of cell nodes is implicitly split into buckets
	///Each bucket has size cfg.bucketSize
	///An id is then a cellId and a bucket (=offset/bucketsize)
	var cellItemExpanderStorage = storage.IndexedDataStore();

	cellItemExpanderStorage.m_cfg = {
		bucketSize: 100 //this one has to be lower than the maximum allowed size returned by the server part
	};
	//id is = {cellId: <int>, bucket: <int> }, itemsInfo is = Map{itemId -> {name: <string>, bbox: <bbox>}}
	cellItemExpanderStorage.m_data = {
		insert: function(id, itemsInfo) {
			var cellId = id.cellId;
			var cellNode = state.dag.cell(cellId);
			for(let itemId of itemsInfo) {
				itemId = parseInt(itemId);
				var childNode;
				if (state.dag.hasItem(itemId)) {
					childNode = state.dag.item(itemId);
				}
				else {
					childNode = state.dag.addNode(itemId, dag.NodeTypes.Item);
					var itemInfo = itemsInfo.get(itemId);
					childNode.name = itemInfo["name"];
					childNode.bbox = itemInfo["bbox"];
				}
				state.dag.addEdge(cellNode, childNode);
			}
			if (itemsInfo.size < cellItemExpanderStorage.m_cfg.bucketSize) {
				cellNode.allItemsFetched = true;
			}
		},
		size: undefined,
		///id = {cellId: <int>, bucket: <int>}
		count: function(id) {
			if (!state.dag.hasCell(id.cellId)) {
				return false;
			}
			var node = state.dag.cell(id.cellId);
			return node.allItemsFetched || node.items.size() >= (id.bucket+1)*cellItemExpanderStorage.m_cfg.bucketSize;
		},
		at: undefined
	};
	//fetching stuff from store is not necessary,
	//we only call the cb to tell that we're done
	cellItemExpanderStorage._requestFromStore = function(cb, cellIds) {
		cb();
	};
	
	cellItemExpanderStorage._insertData = function(dataIds, data) {
		for(let dataId of dataIds) {
			this.m_data.insert(dataId, data.get(dataId));
		}
	},
	
	cellItemExpanderStorage._getData = function(cb, remoteRequestId) {
		//ids are of the form [{cellId: <int>, bucket: <int> }]
		//buckets have to be the same for all
		var ids = this._remoteRequestDataIds(remoteRequestId);
		console.assert(ids.length);
		
		var offset = ids[0].bucket * cellItemExpanderStorage.m_cfg.bucketSize;
		
		var requestIds = [];
		for(let x of ids) {
			requestIds.push(x.cellId);
		}
		
		//cellInfo is of the form {cellId: [itemId]}
		state.cqr.getCellItems(requestIds, function(cellInfo) {
			var itemsToFetch = tools.SimpleSet();
			
			for(let cellId of requestIds) {
				console.assert(cellInfo[cellId] !== undefined);
				itemsToFetch.insertArray( tools.toIntArray( cellInfo[cellId] ) );
			}

			oscar.getItems(itemsToFetch.toArray(), function(items) {
				var itemId2Item = new Map();
				for(let item of items) {
					itemId2Item.set(item.id(), item);
				}
				var res = new Map();
				for(let id of ids) {
					var ci = cellInfo[id.cellId];
					var result_ci = new Map();
					//it may be the case that a cell does not have any items.
					//Which is the case if the offset is too large
					for(let itemId of ci) {
						itemId = parseInt(itemId);
						if (itemId2Item.has(itemId)) {
							let item = itemId2Item.get(itemId);
							result_ci.set(itemId, {
								"name" : item.name(),
								"bbox" : item.bbox()
							});
						}
						else {
							console.assert(false);
						}
					}
					console.assert(result_ci.size === parseInt(ci.length));
					res.set(id, result_ci);
				}
				//result is of the form Map{ {cellId: <int>, bucket: <int>} -> Map{itemId -> {name: <string>, bbox: <bbox>}} }
				cb(res, remoteRequestId);
			}, tools.defErrorCB);
		}, tools.defErrorCB, cellItemExpanderStorage.m_cfg.bucketSize, offset);
	};
	
	var cellItemExpander = {
		m_storage: cellItemExpanderStorage,
	   
		setBulkItemFetchCount: function(value) {
			cellItemExpander.m_storage.m_cfg.bucketSize = value;
		},
		
	   //request is of the form [{cellId: <int>, count: <int>}]
		fetch: function(cb, request) {
			var storageRequests = tools.SimpleHash(); //bucket -> [{cellId: <int>, bucket: bucket}]
			for(let x of request) {
				console.assert(state.dag.hasCell(x.cellId));
				var cellNode = state.dag.cell(x.cellId);
				if (!cellNode.allItemsFetched && cellNode.items.size() < x.count) {
					//split this request into the appropriate buckets
					let bucket = Math.floor( cellNode.items.size() / cellItemExpander.m_storage.m_cfg.bucketSize );
					do {
						if (!storageRequests.count(bucket)) {
							storageRequests.insert(bucket, []);
						}
						storageRequests.at(bucket).push({cellId: parseInt(x.cellId), bucket: bucket});
						++bucket;
					} while(bucket*cellItemExpander.m_storage.m_cfg.bucketSize < x.count);
				}
			}
			//we have to group the request by buckets
			var myCB = tools.AsyncCallBackHandler(storageRequests.size()+1, cb);
			for(let bucket of storageRequests.keys()) {
				cellItemExpander.m_storage.fetch(function() {
					myCB.inc();
				}, storageRequests.at(bucket));
			}
			myCB.inc();
		}
	};

	var dagExpander = function() {
		return {
			regionChildrenExpander: regionChildrenExpander,
			regionCellExpander: regionCellExpander,
			cellDataFetcher: cellDataFetcher,
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
				this.cellItemExpander.setBulkItemFetchCount(value);
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
				if (! $.isArray(cellIds) ) {
					cellIds = [parseInt(cellIds)];
				}
				var request = [];
				for(let cellId of cellIds) {
					request.push({cellId: parseInt(cellId), count: items2FetchPerCell}); 
				}
				var spinnerId = state.startLoadingSpinner();
				this.cellItemExpander.fetch(function() {
					state.endLoadingSpinner(spinnerId);
					cb();
				}, request);
			},

			expandRegionCells: function(regionIds, cb) {
				if (! $.isArray(regionIds) ) {
					regionIds = [parseInt(regionIds)];
				}
				var spinnerId = state.startLoadingSpinner();
				this.regionCellExpander.fetch(function() {
					state.endLoadingSpinner(spinnerId);
					cb();
				}, regionIds);
			},
	   
			expandRegionChildren: function(regionIds, cb) {
				if (! $.isArray(regionIds) ) {
					regionIds = [parseInt(regionIds)];
				}
				var spinnerId = state.startLoadingSpinner();
				this.regionChildrenExpander.fetch(function() {
					state.endLoadingSpinner(spinnerId);
					cb();
				}, regionIds);
			},
			
			retrieveCellData: function(cellIds, cb) {
				if (! $.isArray(cellIds) ) {
					cellIds = [parseInt(cellIds)];
				}
				var spinnerId = state.startLoadingSpinner();
				this.cellDataFetcher.fetch(function() {
					state.endLoadingSpinner(spinnerId);
					cb();
				}, cellIds);
			}
		}
	};
	
	return {
		dagExpander: function() {
			return dagExpander();
		}
	};
});
