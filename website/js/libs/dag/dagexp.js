define(["jquery", "tools", "state", "spinner", "oscar"], function ($, tools, state, spinner, oscar) {
	var regionChildrenExpander = oscar.IndexedDataStore();
	//childrenInfo is the same as the
	//info returned from oscar.SimpleCqr.regionChildrenInfo()
	regionChildrenExpander.m_data = {
		insert: function(parentId, childrenInfo) {
			for(var i in childrenInfo) {
				var parentNode = state.dag.region(parentId);
				var childNode = state.dag.addNode(childrenInfo[i]["id"], dag.NodeTypes.Region);
				childNode.count = childrenInfo[i]["apxitems"]
				state.dag.addEdge(parentNode, childNode);
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
		};
	};
	//fetching stuff from store is not necessary,
	//we only call the cb to tell that we're done
	regionChildrenExpander._requestFromStore(cb, parentIds) {
		cb();
	};
	regionChildrenExpander._getData(cb, remoteRequestId) {
		var parentIds = handler._remoteRequestDataIds(remoteRequestId);
		var result = {};
		var resultSize = 0;
		
		var myWrapper = function(parentId) {
			state.cqr.regionChildrenInfo(parentId, function(childrenInfo) {
				resultSize += 1;
				result[parentId] = childrenInfo;
				if (resultSize == parentIds.length) {
					cb(result, remoteRequestId);
				}
			}, tools.defErrorCB);
		};
		
		for(var i in parentIds) {
			myWrapper(parentIds[i]);
		}
	};
	
	var regionCellExpander = oscar.IndexedDataStore();
	//cellInfo is a simple array [cellId]
	regionCellExpander.m_data = {
		insert: function(parentId, cellInfo) {
			for(var i in cellInfo) {
				var parentNode = state.dag.region(parentId);
				var childNode = state.dag.addNode(cellInfo[i], dag.NodeTypes.Cell);
				state.dag.addEdge(parentNode, childNode);
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
		};
	};
	//fetching stuff from store is not necessary,
	//we only call the cb to tell that we're done
	regionCellExpander._requestFromStore(cb, parentIds) {
		cb();
	};
	regionCellExpander._getData(cb, remoteRequestId) {
		var parentIds = handler._remoteRequestDataIds(remoteRequestId);
		var result = {};
		var resultSize = 0;
		
		var myWrapper = function(parentId) {
			state.cqr.getCells(parentId, function(cellInfo) {
				resultSize += 1;
				result[parentId] = cellInfo;
				if (resultSize == parentIds.length) {
					cb(result, remoteRequestId);
				}
			}, tools.defErrorCB);
		};
		
		for(var i in parentIds) {
			myWrapper(parentIds[i]);
		}
	};

	var dagExpander = function() {
		return {
			cfg: {
				preloadShapes : true,
				bulkItemFetchCount: 100
			},
			
			regionChildrenExpander: regionChildrenExpander,
			regionCellExpander: regionCellExpander,
			cellItemExpander: cellItemExpander,
	   
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
								state.dag.addChild(state.dag.region(regionId), state.dag.region(children[i]));
							}
						}
						else {
							state.dag.at(regionId).isLeaf = true;
						}
					}

					for (var j in subSet.rootchildren) {
						state.dag.addChild(state.dag.region(0xFFFFFFFF), state.dag.region(subSet.rootchildren[j]));
					}
					myCB();
				}

				state.cqr.getDag(subSetHandler, tools.defErrorCB);
			},
			
			expandCells: function(cellIds, cb, offset) {
				
			}
			
			//if cb is called, all relevant items should be in the cache
			//BUG: THis is broken by new dag
			expandDagItems: function(parentId, cb, offset) {
				if (offset === undefined) {
					offset = 0;
				}
				function myOp(regionId, itemIds) {
					console.assert(state.dag.hasRegion(regionId), regionId);

					if (!itemIds.length) {
						if (offset === 0) {
							state.dag.region(regionId).mayHaveItems = false;
						}
						de._flushItemsQueue(parentId, offset);
						return;
					}
					
					oscar.getItems(itemIds, function(items) {
						var parentNode = state.dag.region(regionId)
						for(var i in items) {
							var item = items[i];
							var itemId = item.id();
							var node = state.dag.addNode(itemId, dag.NodeTypes.Item);
							node.name = item.name();
							node.bbox = item.bbox();
							state.dag.addChild(regionId, itemId);
						}
						de._flushItemsQueue(parentId, offset);
					});
				};
				var parentNode = state.dag.node(parentId);
				if (parentNode.count >= offset && parentNode.items.size() <= offset) {
					if (de.inItemsQueue(parentId, offset)) {
						de._insertItemsQueue(parentId, offset, cb);
						return;
					}
					else {
						de._insertItemsQueue(parentId, offset, cb);
					}
					state.cqr.regionExclusiveItemIds(parentId,
						myOp,
						tools.defErrorCB,
						offset,
						de.cfg.bulkItemFetchCount
					);
				}
				else {
					cb();
				}
			},
			expandDag: function(parentId, cb) {
				console.assert(state.dag.hasRegion(parentId));
				
				if (de.inChildrenQueue(parentId)) {
					de._insertChildrenQueue(parentId, cb);
					return;
				}
				else {
					de._insertChildrenQueue(parentId, cb);
				}
				
				var myCBCount = 0;
				var myCB = function() {
					myCBCount += 1;
					if (myCBCount == 3) {
						de._flushChildrenQueue(parentId);
					}
				};
				function processChildren(regionChildrenInfo) {
					if (!regionChildrenInfo.length) { //parent is a leaf node
						state.dag.region(parentId).isLeaf = true;
						de._flushChildrenQueue(parentId);
						return;
					}
					
					var childIds = [];
					var parentNode = state.dag.at(parentId);

					for (var i in regionChildrenInfo) {
						var childInfo = regionChildrenInfo[i];
						var childId = childInfo['id'];
						if (!state.dag.hasRegion(childId)) {
							state.dag.addNode(childId, dag.NodeTypes.Region);
						}
						state.dag.region(childId).count = childInfo['apxitems'];
						childIds.push(childId);
					}
					
					//cache the shapes
					if (de.cfg.preloadShapes) {
						oscar.fetchShapes(childIds, function() {});
					}
					
					//now get the item info for the name and the bbox
					oscar.getItems(childIds,
						function (items) {
							console.assert(items.length == childIds.length);
							console.assert(state.dag.hasRegion(parentId));
							var parentNode = state.dag.region(parentId);
							for (var i in items) {
								var item = items[i];
								var node = state.dag.region(item.id());
								node.bbox = item.bbox();
								node.name = item.name();
								//add child to our node
								state.dag.addChild(parentNode, node);
							}
							myCB();
						}
					);
					
					state.cqr.clusterHints(childIds, function(hints) {
						for(var id in hints) {
							state.dag.region(id).clusterHint = hints[id];
						}
						myCB();
					}, tools.defErrorCB);
				};
				
				spinner.startLoadingSpinner();
				state.cqr.regionChildrenInfo(parentId, function(regionChildrenInfo) {
					spinner.endLoadingSpinner()
					processChildren(regionChildrenInfo);
				},
				tools.defErrorCB
				);
				
				de.expandDagItems(parentId, myCB);
			}
		};
	}
	
	return {
		dagExpander: function() {
			return dagExpander();
		}
	};
});
