define(["jquery", "tools"], function ($, tools) {
    return d = {
		NodeTypes: {
			Region: 0,
			Cell: 1,
			Item: 2
		},
		DisplayStates: {
			None: 0,
			DoDraw: 1,
			InResultsTab: 2,
			InItemList: 4,
			HasItemMarker: 8,
			HasClusterMarker: 16
		},
		//type should be either region, cell or item
		Node: function(id, type) {
			return node = {
				parents: tools.SimpleSet(),
				id: id,
				type: type,
				//these are public, mutable
				displayState: d.DisplayStates.None,
				name: undefined,
				bbox: undefined
			}
		},
		ItemNode: function(id) {
			return d.Node(id, d.NodeTypes.Item);
		},
		CellNode: function(id) {
			var node = d.Node(id, d.NodeTypes.Cell);
			node.items = tools.SimpleSet();
			return node;
		},
		RegionNode: function(id) {
			var node = d.Node(id, d.NodeTypes.Region);
			node.children = tools.SimpleSet();
			node.items = tools.SimpleSet();
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
				itemSize: functio() {
					return this.m_items.size();
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
				addEdge: function(sourceNode, targetNode) {
					if (! sourceNode instanceof d.Node || !targetNode instanceof d.Node) {
						throw new Error();
						return undefined;
					}
					if (targetNodee.type === d.NodeTypes.Item) {
						console.assert(sourceNode.type === d.NodeTypes.Region || sourceNode.type === d.NodeTypes.Cell);
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
						console.assert(false);
					}
					childNode.parents.insert(parentId);
				},
				//add a rootNode
				addRoot: function(id) {
					return this.addNode(id, d.NodeTypes.Region);
				},
				addNode: function(id, type) {
					if (!this.hasNode(id)) {
						if (type === d.NodeTypes.Region) {
							this.m_nodes.insert(id, this.RegionNode(id));
						}
						else if (type === d.NodeTypes.Cell) {
							this.m_nodes.insert(id, this.ItemNode(id));
						}
						else if (type === d.NodeTypes.Item) {
							
						}
					}
					return this.node(id);
				},
				//BUG: does not remove children though they may be unlinked
				removeNode: function(id) {
					if (!this.hasNode(id)) {
						return;
					}
					var n = this.node(id);
					if (n.type === d.NodeTypes.Region) {
						for(var parent in n.parents.values()) {
							this.node(parent).children.erase(id);
						}
						for(var child in n.children.values()) {
							this.node(child).parents.erase(id);
						}
					}
					else { //node is an item node
						for(var parent in n.parents.values()) {
							this.node(parent).items.erase(id);
						}
					}
					this.m_nodes.erase(id);
				},
				//calls cb for each node
				each: function(cb) {
					for(var i in this.m_nodes.values()) {
						cb(this.at(i));
					}
				},
				//calls cb for every visited node, iff cb() returns false, then the traversal is stopped
				bfs: function(startNode, cb) {
					if (!this.hasNode(startNode)) {
						return;
					}
					var queue = [startNode];
					for(var i = 0; i < queue.length; ++i) {
						var node = this.at(queue[startNode]);
						var ret = cb(node);
						if (ret !== undefined && ret == false) {
							return;
						}
						for(var childId in node.children.values()) {
							queue.push(childId);
						}
					}
				},
				//if cb returns false, then the descent is stopped (but not the traversal!)
				dfs: function(startNode, cb) {
					if (!this.hasNode(startNode)) {
						return;
					}
					var node = this.at(startNode);
					var ret = cb(node);
					if (ret !== undefined && ret == false) {
						return;
					}
					for(var childId in node.children.values()) {
						this.dfs(childId, cb);
					}
				},
				clearDisplayState: function() {
					this.each(function(node) {
						node.displayState = d.DisplayStates.None;
					});
				},
				clear: function() {
					this.m_nodes = tools.SimpleHash();
				}
			};
		}
	};
});

