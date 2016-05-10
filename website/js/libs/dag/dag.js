define(["jquery", "tools"], function ($, tools) {
    return {
		dag: function() {
			return {
				Node: function(id) {
					return node = {
						//public, but const!
						parents: tools.SimpleSet(),
						children: tools.SimpleSet(),
						id: id,
						//these are public, mutable
						name: undefined,
						count: undefined,
						bbox: undefined
					}
				};
				m_nodes: tools.SimpleHash(), //maps from nodeId -> Node
				hasNode: function(id) {
					return this.m_nodes.count(id);
				},
				at: function(id) {
					return this.node(id);
				},
				node: function(id) {
					return this.m_nodes.at(id).node;
				},
				addChild: function(parentId, childId) {
					if (this.hasNode(parentId) && this.hasNode(childId)) {
						pn.children.insert(childId);
						cn.parents.insert(parentId);
					}
					else {
						throw new RangeError();
					}
				},
				//add a rootNode
				addRoot: function(id) {
					this.addNode(id);
				},
				addNode: function(id) {
					if (!this.hasNode(id)) {
						this.m_nodes.insert(id, this.Node(id));
					}
				},
				removeNode: function(id) {
					if (!this.hasNode(id)) {
						return;
					}
					var n = this.node(id);
					for(var parent in n.parents.values()) {
						this.node(parent).children.erase(id);
					}
					for(var child in n.children.values()) {
						this.node(child).parents.erase(id);
					}
					this.m_nodes.erase(id);
				}
			};
		}
	};
});

