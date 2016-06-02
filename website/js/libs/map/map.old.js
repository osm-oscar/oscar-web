{
	
		flatCqrTreeDataSource: function (cqr) {
			function processChildren(regionChildrenInfo, context) {
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
						if (!context.visualizeItems) {
							for (var i in items) {
								item = items[i];
								itemId = item.id();
								itemMap[itemId] = item;
								//add node either if no ohPath is given or the node is in our ohPath. If it's the last but there are too many items in the node
								if (!cqr.ohPath().length || ($.inArray(itemId, cqr.ohPath()) != -1 || (parentRid === cqr.ohPath()[cqr.ohPath().length - 1] && parentCount > oscar.maxFetchItems))) {
									if (!state.dag.count(itemId)) {
										var node = state.dag.addNode(itemId, dag.NodeTypes.Region);
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
									node = state.dag.addNode(itemId, dag.NodeTypes.Region);
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
									map.visualizeRegionItems(parentRid);
								}
								else {
									if (state.dag.at(parentRid).children.size() == 0) {
										map.visualizeRegionItems(parentRid);
									}
									else {
										for (var child in state.dag.at(parentRid).children) {
											var id = state.dag.at(parentRid).children[child].id;
											map.visualizeRegionItems(parentRid);
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
							oscar.fetchShapes(regions, function() {});

							if (state.visualizationActive) {
								tree.refresh(parentRid);
							}
						}

						if (context.pathProcessor) {
							context.pathProcessor.process();
						}

					}
				);
			}

			return function(context) {
				spinner.startLoadingSpinner();
				cqr.regionChildrenInfo(context.rid, function (regionChildrenInfo) {
						spinner.endLoadingSpinner()
						processChildren(regionChildrenInfo, context);
					},
					tools.defErrorCB
				);
			};
		},

		//@param drawn: dag nodes that are drawn in some way
		drawClusters: function (node, drawn) {
			if (!node) {
				return;
			}

			if (node.children.size()) {
				for (var childId in node.children.values()) {
					var childNode = state.dag.at(childId);
					var myOverlap = tools.percentOfOverlap(state.map, childNode.bbox);
					
					if (
						(myOverlap >= config.clusters.bboxOverlap) ||
						(myOverlap > config.clusters.shapeOverlap && oscar.shapeCache.count(childNode.id) && oscar.intersect(state.map.getBounds(), oscar.shapeCache.at(childNode.id)))
					   )
					{
						map.drawClusters(childNode, drawn);
					}
					else {
						if (childNode.type === dag.NodeTypes.Region) {
							map.addClusterMarker(childNode);
							drawn.insert(childNode.id);
						}
						else if (childNode.type === dag.NodeTypes.Item) { //this is an item
							map.addItemMarker(childNode);
							map.addDagItemToResultList(childNode);
							drawn.insert(childNode.id);
						}
					}
				}
			}
			//fetch children/items
			else if (node.count) {
				state.regionHandler({rid: node.id, draw: true, visualizeItems: true});
			}
		},
		//TODO: improve this; its currently no possible to load more items into the result list
		//But this is necessary for large result regions
		visualizeRegionItems: function (rId, offset=0) {
			function myOp(regionId, itemIds) {
				console.assert(state.dag.hasNode(regionId), regionId);
				//cache items
				oscar.fetchItems(itemIds, function() {});
				
				// manage items -> kill old items if there are too many of them and show clusters again
				if (map.itemMarkers.size() + itemIds.length > config.maxBufferedItems) {
					for (var itemId in map.itemmarkers.layers()) {
						node = state.dag.at(itemId);
						for (var parentId in node.parents.values()) {
							if (!map.clusterMarkers.count(parentId)) {
								map.clusterMarkers.add(parentId, node.count);
							}
						}
						map.removeItemMarker(node.id);
						dag.removeNode(node.id);
					}
				}
				
				//insertItems expects items
				oscar.getItems(itemIds, function(items) {
					map.resultListTabs.insertItems(regionId, items);
				
					//add the items as children to the dag
					for(var i in items) {
						var item = items[i];
						var itemId = item.id();
						var node = state.dag.addNode(itemId, dag.NodeTypes.Item);
						node.name = item.name();
						node.bbox = item.bbox();
						state.dag.addChild(regionId, itemId);
					}
					if (state.visualizationActive) {
						tree.refresh(regionId);
					}
				});
			};
			
			//add the appropriate tab to the result list and insert the items to the list
			map.resultListTabs.addRegion(regionId, state.dag.at(regionId).name, state.dag.at(regionId).count);

			//remove the cluster marker of this region
			map.clusterMarkers.remove(regionId);

			state.cqr.regionItemIds(rId,
				myOp,
				tools.defErrorCB,
				offset
			);
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
							var drawn = tools.SimpleSet();
							map.closePopups();
							map.clusterMarkers.clear();

							if (this.path && this.path.length) {
								// start at the target region (last element of ohPath)
								map.drawClusters(state.dag.at(this.path[this.path.length - 1]), drawn);
							}
							else {
								// start at Node "World"
								map.drawClusters(state.dag.at(0xFFFFFFFF), drawn);
							}
							
							//remove markers/tabs/items that are no longer drawn
							removedRegions = [];
							removedItems = [];
							state.dag.each(function(node) {
								if (!drawn.count(node.id)) {
									console.assert(node.type === "region" || node.type === "item", node);
									if (node.type === "region") {
										removedRegions.push(node.id);
									}
									else (node.type === "item") {
										removedItems.push(node.id);
									}
								}
							});
							
							//first remove items from the dag and their ItemMarkers
							for(var i in removedItems) {
								var itemId = removedItems[i];
								state.dag.removeNode(itemId);
								map.removeItemMarker(itemId);
							}
							
							//now remove the regions from the tablist, this also kills items from the result list
							for(var i in removedRegions) {
								var regionId = removedRegions[i];
								map.resultListTabs.removeRegion(regionId);
							}
							
							timer.stop();
						}.bind(this);
						state.map.on("zoomend dragend", state.handler);
					}
				}
			};
		}
}