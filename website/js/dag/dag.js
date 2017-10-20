define(["jquery", "tools"], function ($, tools) {
    var d = {
		NodeTypes: {
			Region: 1,
			Cell: 2,
			Item: 4,
			//thw following are just for convinience usable in the graph traversal functions
			All: 7
		},
		DisplayStates: {
			None: 0,
			DoDraw: 1,
			InResultsTab: 2,
			InItemList: 4,
			HasItemMarker: 8,
			HasRegionClusterMarker: 16,
			HasCellClusterMarker: 32,
			InResultsTab2: 64
		},
		//type should be either region, cell or item
		Node: function(id, type) {
			var node = {
				parents: tools.SimpleSet(),
				id: id,
				type: type,
				//these are public, mutable
				displayState: d.DisplayStates.None,
				bbox: undefined
			};
			return node;
		},
		NamedNode: function(id, type) {
			var node = d.Node(id, type);
			node.name = undefined;
			return node;
		},
		ItemNode: function(id) {
			var node = d.NamedNode(id, d.NodeTypes.Item);
			return node;
		},
		CellNode: function(id) {
			var node = d.Node(id, d.NodeTypes.Cell);
			node.items = tools.SimpleSet();
			node.allItemsFetched = false;
			return node;
		},
		RegionNode: function(id) {
			var node = d.NamedNode(id, d.NodeTypes.Region);
			node.children = tools.SimpleSet();
			node.cells = tools.SimpleSet();
			node.count = -1;
			node.isLeaf = false;
			node.mayHaveItems = true;
			return node;
		},
		//this is a dag for the hierarchy
		dag: function() {
			return {
				m_regions: tools.SimpleHash(), //maps from nodeId -> RegionNode
				m_cells: tools.SimpleHash(), //maps from nodeId -> CellNode
				m_items: tools.SimpleHash(), //maps from nodeId -> ItemNode
				regionSize: function() {
					return this.m_regions.size();
				},
				cellSize: function() {
					return this.m_cells.size();
				},
				itemSize: function() {
					return this.m_items.size();
				},
				hasNode: function(id, type) {
					if (type === d.NodeTypes.Region) {
						return this.hasRegion(id);
					}
					else if (type === d.NodeTypes.Cell) {
						return this.hasCell(id);
					}
					else if (type === d.NodeTypes.Item) {
						return this.hasItem(id);
					}
					else {
						console.assert(false, "Invalid node type", id, type);
					}
					return false;
				},
				hasRegion: function(id) {
					return this.m_regions.count(id);
				},
				hasCell: function(id) {
					return this.m_cells.count(id);
				},
				hasItem: function(id) {
					return this.m_items.count(id);
				},
				region: function(id) {
					return this.m_regions.at(id);
				},
				cell: function(id) {
					return this.m_cells.at(id);
				},
				item: function(id) {
					return this.m_items.at(id);
				},
				node: function(id, type) {
					if (type === d.NodeTypes.Region) {
						return this.region(id);
					}
					else if (type === d.NodeTypes.Cell) {
						return this.cell(id);
					}
					else if (type === d.NodeTypes.Item) {
						return this.item(id);
					}
					else {
						console.assert(false, "Invalid node type", id, type);
					}
					return undefined;
				},
				addEdge: function(sourceNode, targetNode) {
					console.assert(this.hasNode(sourceNode.id, sourceNode.type));
					console.assert(this.hasNode(targetNode.id, targetNode.type));

					var childId = targetNode.id;
					var parentId = sourceNode.id;
					if (targetNode.type === d.NodeTypes.Item) {
						console.assert(sourceNode.type === d.NodeTypes.Cell);
						sourceNode.items.insert(childId);
					}
					else if (targetNode.type === d.NodeTypes.Cell) {
						console.assert(sourceNode.type === d.NodeTypes.Region);
						sourceNode.cells.insert(childId);
					}
					else if (targetNode.type === d.NodeTypes.Region) {
						console.assert(sourceNode.type === d.NodeTypes.Region);
						sourceNode.children.insert(childId);
					}
					else {
						console.assert(false, "Invalid node type", id, type);
					}
					targetNode.parents.insert(parentId);
				},
				//add a rootNode
				addRoot: function(id) {
					return this.addNode(id, d.NodeTypes.Region);
				},
				addNode: function(id, type) {
					if (!this.hasNode(id, type)) {
						if (type === d.NodeTypes.Region) {
							this.m_regions.insert(id, d.RegionNode(id));
						}
						else if (type === d.NodeTypes.Cell) {
							this.m_cells.insert(id, d.CellNode(id));
						}
						else if (type === d.NodeTypes.Item) {
							this.m_items.insert(id, d.ItemNode(id));
						}
						else {
							console.assert(false, "Invalid node type", id, type);
						}
					}
					return this.node(id, type);
				},
				removeNode: function(node) {
					console.assert(this.hasNode(node.id, node.type));
					if (node.type === d.NodeTypes.Region) {
						for(let parentId of node.parents.builtinset()) {
							this.region(parentId).children.erase(node.id);
						}
						for(let childId of node.children.builtinset()) {
							this.region(childId).parents.erase(node.id);
						}
						for(let cellId of node.cells.builtinset()) {
							this.cell(cellId).parents.erase(node.id);
						}
						this.m_regions.erase(node.id);
					}
					else if (node.type === d.NodeTypes.Cell) {
						for(let parentId of node.parents.builtinset()) {
							this.region(parentId).cells.erase(node.id);
						}
						for(let itemId of node.items.builtinset()) {
							this.item(itemId).parents.erase(node.id);
						}
						this.m_cells.erase(node.id);
					}
					else if (node.type === d.NodeTypes.Item) {
						for(let parentId of node.parents.builtinset()) {
							this.cell(parentId).items.erase(node.id);
						}
						this.m_items.erase(node.id);
					}
					else {
						console.assert(false, "Invalid node type");
					}
				},
				//calls cb for each node, default param is d.NodeTypes.All
				each: function(cb, types) {
					if (types === undefined) {
						types = d.NodeTypes.All;
					}
					if (types & d.NodeTypes.Region) {
						for(let region of this.m_regions.builtinmap().values()) {
							cb(region);
						}
					}
					if (types & d.NodeTypes.Cell) {
						for(let cell of this.m_cells.builtinmap().values()) {
							cb(cell);
						}
					}
					if (types & d.NodeTypes.Item) {
						for(let item of this.m_items.builtinmap().values()) {
							cb(item);
						}
					}
				},
				//calls cb for every visited node, iff cb() returns false, then the traversal is stopped
				bfs: function(startNode, cb, types) {
					if (types === undefined) {
						types = d.NodeTypes.All;
					}
					console.assert(this.hasNode(startNode.id, startNode.type));
					var queue = [{id: startNode.id, type: startNode.type}];
					for(var i = 0; i < queue.length; ++i) {
						var qe = queue[i];
						var node = this.node(qe.id, qe.type);
						var ret = cb(node);
						if (ret !== undefined && ret == false) {
							return;
						}
						if (node.type === d.NodeTypes.Region) {
							if (types & d.NodeTypes.Region) {
								for(let childId of node.children.builtinset()) {
									queue.push({id: childId, type: d.NodeTypes.Region});
								}
							}
							if (types & d.NodeTypes.Cell) {
								for(let cellId of node.cells.builtinset()) {
									queue.push({id:cellId, type: d.NodeTypes.Cell});
								}
							}
							
						}
						else if (node.type === d.NodeTypes.Cell) {
							if (types & d.NodeTypes.Item) {
								for(let itemId of node.items.builtinset()) {
									queue.push({id:itemId, type: d.NodeTypes.Item});
								}
							}
						}
					}
				},
				//if cb returns false, then the descent is stopped (but not the traversal!)
				dfs: function(startNode, cb) {
					console.assert(this.hasNode(startNode.id, startNode.type));
					console.assert(startNode.type === d.NodeTypes.Region);
					var ret = cb(startNode);
					if (ret !== undefined && ret == false) {
						return;
					}
					for(let childId of startNode.children.builtinset()) {
						var childNode = this.region(childId);
						this.dfs(childNode, cb);
					}
				},
				//visit the subtree under the node startNode in bottom-up order
				bottomUp: function(startNode, cb) {
					console.assert(startNode.type === d.NodeTypes.Region);
					console.assert(this.hasNode(startNode.id, startNode.type));
					var queue = [startNode.id];
					var visited = {};
					for(var i = 0; i < queue.length; ++i) {
						var node = this.region(queue[i]);
						for(let childId of node.children.builtinset()) {
							if (visited[childId] === undefined) {
								queue.push(childId);
								visited[childId] = childId;
							}
						}
					}
					for(var i = queue.length-1; i >= 0; --i) {
						cb(this.region(queue[i]));
					}
				},
				clearDisplayState: function(types) {
					if (types === undefined) {
						types = d.NodeTypes.All;
					}
					this.each(function(node) {
						node.displayState = d.DisplayStates.None;
					}, types);
				},
				clear: function() {
					this.m_regions = tools.SimpleHash();
					this.m_cells = tools.SimpleHash();
					this.m_items = tools.SimpleHash();
				}
			};
		}
	};

	return d;
});
