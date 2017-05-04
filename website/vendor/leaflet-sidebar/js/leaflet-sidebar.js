/**
 * @name Sidebar
 * @class L.Control.Sidebar
 * @extends L.Control
 * @param {string} id - The id of the sidebar element (without the # character)
 * @param {Object} [options] - Optional options object
 * @param {string} [options.position=left] - Position of the sidebar: 'left' or 'right'
 * @see L.control.sidebar
 */
L.Control.Sidebar = L.Control.extend(/** @lends L.Control.Sidebar.prototype */ {
    includes: L.Mixin.Events,

    options: {
        position: 'left'
    },

    initialize: function (id, options) {
        var i, child;

        L.setOptions(this, options);

        // Find sidebar HTMLElement
        this._sidebar = L.DomUtil.get(id);

        // Attach .sidebar-left/right class
        L.DomUtil.addClass(this._sidebar, 'sidebar-' + this.options.position);

        // Attach touch styling if necessary
        if (L.Browser.touch)
            L.DomUtil.addClass(this._sidebar, 'leaflet-touch');

        // Find sidebar > div.sidebar-content
		content_container = this._findChildByClass(this._sidebar, 'sidebar-content');

        // Find sidebar ul.sidebar-tabs > li, sidebar .sidebar-tabs > ul > li
        this._tabitems = this._sidebar.querySelectorAll('ul.sidebar-tabs > li, .sidebar-tabs > ul > li');
        for (i = this._tabitems.length - 1; i >= 0; i--) {
            this._tabitems[i]._sidebar = this;
        }
        
        //Find sidebar > div.sidebar-content > div.sidebar-pane-titles
		var pane_titles_container = this._findChildByClass(content_container, 'sidebar-pane-titles');
        //Find sidebar > div.sidebar-content > div.sidebar-panetitles > div.sidebar-pane-title
        this._titles = this._findChildrenByClass(pane_titles_container, 'sidebar-pane-title');
        
		//Find close buttons
		this._closeButtons = [];
		for(let child of this._titles) {
			let closeButtons = child.querySelectorAll('.sidebar-close');
			for (let j = 0; j < closeButtons.length; j++) {
				this._closeButtons.push( closeButtons[j] );
			}
		}
		
        //Find sidebar > div.sidebar-content > div.sidebar-pane
		this._panes_container = this._findChildByClass(content_container, 'sidebar-panes');
        
        // Find sidebar > div.sidebar-content > div.sidebar-panes > div.sidebar-pane
        this._panes = this._findChildrenByClass(this._panes_container, 'sidebar-pane');
		
		this._scrollp = new Array(this._panes.length);
		this._scrollp.fill(0);
		
		console.log("done");
    },

    /**
     * Add this sidebar to the specified map.
     *
     * @param {L.Map} map
     * @returns {Sidebar}
     */
    addTo: function (map) {
        var i, child;

        this._map = map;

        for (i = this._tabitems.length - 1; i >= 0; i--) {
            child = this._tabitems[i];
            var sub = child.querySelector('a');
            if (sub.hasAttribute('href') && sub.getAttribute('href').slice(0,1) == '#') {
                L.DomEvent
                    .on(sub, 'click', L.DomEvent.preventDefault )
                    .on(sub, 'click', this._onClick, child);
            }
        }

        for (i = this._closeButtons.length - 1; i >= 0; i--) {
            child = this._closeButtons[i];
            L.DomEvent.on(child, 'click', this._onCloseClick, this);
        }

        return this;
    },

    /**
     * @deprecated - Please use remove() instead of removeFrom(), as of Leaflet 0.8-dev, the removeFrom() has been replaced with remove()
     * Removes this sidebar from the map.
     * @param {L.Map} map
     * @returns {Sidebar}
     */
     removeFrom: function(map) {
         console.log('removeFrom() has been deprecated, please use remove() instead as support for this function will be ending soon.');
         this.remove(map);
     },

    /**
     * Remove this sidebar from the map.
     *
     * @param {L.Map} map
     * @returns {Sidebar}
     */
    remove: function (map) {
        var i, child;

        this._map = null;

        for (i = this._tabitems.length - 1; i >= 0; i--) {
            child = this._tabitems[i];
            L.DomEvent.off(child.querySelector('a'), 'click', this._onClick);
        }

        for (i = this._closeButtons.length - 1; i >= 0; i--) {
            child = this._closeButtons[i];
            L.DomEvent.off(child, 'click', this._onCloseClick, this);
        }

        return this;
    },

    /**
     * Open sidebar (if necessary) and show the specified tab.
     *
     * @param {string} id - The id of the tab to show (without the # character)
     */
    open: function(id) {
		this._storeScrollP();
		
		var titleId = "sidebar-pane-title-" + id;
		var paneId = "sidebar-pane-" + id;

        for (let child of this._titles) {
            if (child.id == titleId)
                L.DomUtil.addClass(child, 'active');
            else if (L.DomUtil.hasClass(child, 'active'))
                L.DomUtil.removeClass(child, 'active');
        }
        
        for (let child of this._panes) {
            if (child.id == paneId)
                L.DomUtil.addClass(child, 'active');
            else if (L.DomUtil.hasClass(child, 'active'))
                L.DomUtil.removeClass(child, 'active');
        }
        
        // remove old active highlights and set new highlight
        for (i = this._tabitems.length - 1; i >= 0; i--) {
            child = this._tabitems[i];
            if (child.querySelector('a').hash == '#' + id)
                L.DomUtil.addClass(child, 'active');
            else if (L.DomUtil.hasClass(child, 'active'))
                L.DomUtil.removeClass(child, 'active');
        }

        this.fire('content', { id: id });

        // open sidebar (if necessary)
        if (L.DomUtil.hasClass(this._sidebar, 'collapsed')) {
            this.fire('opening');
            L.DomUtil.removeClass(this._sidebar, 'collapsed');
        }
        
        this._restoreScrollP();

        return this;
    },

    /**
     * Close the sidebar (if necessary).
     */
    close: function() {
		this._storeScrollP();
		
        // remove old active highlights
        for (var i = this._tabitems.length - 1; i >= 0; i--) {
            var child = this._tabitems[i];
            if (L.DomUtil.hasClass(child, 'active'))
                L.DomUtil.removeClass(child, 'active');
        }

        // close sidebar
        if (!L.DomUtil.hasClass(this._sidebar, 'collapsed')) {
            this.fire('closing');
            L.DomUtil.addClass(this._sidebar, 'collapsed');
        }

        return this;
    },

    /**
     * @private
     */
    _onClick: function() {
        if (L.DomUtil.hasClass(this, 'active'))
            this._sidebar.close();
        else if (!L.DomUtil.hasClass(this, 'disabled'))
            this._sidebar.open(this.querySelector('a').hash.slice(1));
    },

    /**
     * @private
     */
    _onCloseClick: function () {
        this.close();
    },
    
    _findChildrenByClass: function(parent, childClass) {
		var result = [];
        for (var i = parent.children.length - 1; i >= 0; i--) {
            child = parent.children[i];
            if (child.tagName == 'DIV' &&
                    L.DomUtil.hasClass(child, childClass))
                result.push(child);
        }
        return result;
	},
    _findChildByClass: function(parent, childClass) {
		var tmp = this._findChildrenByClass(parent, childClass);
        return tmp.length ? tmp[0] : undefined;
	},
	//store scroll position of active panes
	_storeScrollP: function() {
        for (let i = 0; i < this._panes.length; ++i) {
			let child = this._panes[i];
            if (L.DomUtil.hasClass(this._panes[i], 'active')){
				this._scrollp[i] = this._panes_container.scrollTop;
			}
        }
	},
	//restore scroll position of active panes
	_restoreScrollP: function() {
        for (let i = 0; i < this._panes.length; ++i) {
            if (L.DomUtil.hasClass(this._panes[i], 'active')){
				this._panes_container.scrollTop = this._scrollp[i];
			}
        }
	},
});

/**
 * Creates a new sidebar.
 *
 * @example
 * var sidebar = L.control.sidebar('sidebar').addTo(map);
 *
 * @param {string} id - The id of the sidebar element (without the # character)
 * @param {Object} [options] - Optional options object
 * @param {string} [options.position=left] - Position of the sidebar: 'left' or 'right'
 * @returns {Sidebar} A new sidebar instance
 */
L.control.sidebar = function (id, options) {
    return new L.Control.Sidebar(id, options);
};
