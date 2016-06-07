define(["jquery", "tools"], function ($, tools) {
    return d = {
		NodeTypes: {
			Region: 0,
			Item: 1
		},
		DisplayStates: {
			None: 0,
			DoDraw: 1,
			InResultsTab: 2,
			InItemList: 4,
			HasItemMarker: 8,
			HasClusterMarker: 16
		},
		//this is a dag for the hierarchy
		dag: function() {
			return {
				//type should be either region or item
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
				ItemNode: function(id, type) {
					return this.Node(id, type);
				},
				RegionNode: function(id, type) {
					var node = this.Node(id, type);
					node.children = tools.SimpleSet();
					node.items = tools.SimpleSet();
					node.count = -1;
					return node;
				},
				m_nodes: tools.SimpleHash(), //maps from nodeId -> (ItemNode | RegionNode)
				size: function() {
					return this.m_nodes.size();
				},
				hasNode: function(id) {
					return this.m_nodes.count(id);
				},
				count: function(id) {
					return this.hasNode(id);
				},
				at: function(id) {
					return this.node(id);
				},
				node: function(id) {
					return this.m_nodes.at(id);
				},
				addChild: function(parentId, childId) {
					if (this.hasNode(parentId) && this.hasNode(childId)) {
						var parentNode = this.node(parentId);
						var childNode = this.node(childId);
						console.assert(parentNode.type === d.NodeTypes.Region, parentNode);
						if (childNode.type === d.NodeTypes.Item) {
							parentNode.items.insert(childId);
						}
						else {
							parentNode.children.insert(childId);
						}
						childNode.parents.insert(parentId);
					}
					else {
						throw new RangeError();
					}
				},
				//add a rootNode
				addRoot: function(id) {
					return this.addNode(id, d.NodeTypes.Region);
				},
				addNode: function(id, type) {
					if (!this.hasNode(id)) {
						if (type === d.NodeTypes.Region) {
							this.m_nodes.insert(id, this.RegionNode(id, type));
						}
						else {
							this.m_nodes.insert(id, this.ItemNode(id, type));
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

