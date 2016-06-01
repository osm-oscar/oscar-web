define(["jquery", "tools"], function ($, tools) {
    return d = {
		DisplayState: {
			None: 0,
			InTabLIst: 1,
			InItemList: 2,
			InClusterMarkers: 4,
			InItemMarkers: 8
		},
		dag: function() {
			return {
				//type should be either "region" or "item"
				Node: function(id, type) {
					return node = {
						//public, but const!
						parents: tools.SimpleSet(),
						children: tools.SimpleSet(),
						id: id,
						type: type,
						displayState: d.DisplayState.None,
						//these are public, mutable
						name: undefined,
						count: undefined,
						bbox: undefined
					}
				},
				m_nodes: tools.SimpleHash(), //maps from nodeId -> Node
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
						this.node(parentId).children.insert(childId);
						this.node(childId).parents.insert(parentId);
					}
					else {
						throw new RangeError();
					}
				},
				//add a rootNode
				addRoot: function(id) {
					return this.addNode(id, "region");
				},
				addNode: function(id, type) {
					if (!this.hasNode(id)) {
						this.m_nodes.insert(id, this.Node(id, type));
					}
					return this.node(id);
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
				},
				//calls cb for each node
				each: function(cb) {
					for(var i in this.m_nodes.values()) {
						cb(this.at(i));
					}
				},
				setDisplayState: function(state) {
					for(var i in this.m_nodes.values()) {
						this.at(i).displayState = state;
					}
				},
				resetDisplayState: function() {
					this.setDisplayState(d.DisplayState.None);
				},
				clear: function() {
					this.m_nodes = tools.SimpleHash();
				}
			};
		}
	};
});

