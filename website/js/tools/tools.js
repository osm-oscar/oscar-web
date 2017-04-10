define(["jquery"], function ($) {
    var tools = {
        /**
         * A wrapper for Map()
         *
         */
		SimpleHash: function () {
			return {
				m_data: new Map(),
				"Symbol.iterator": function() {
					return this.m_data["Symbol.iterator"]();
				},
				values: function() {
					return this.m_data.keys();
				},
				begin: function() {
					this["Symbol.iterator"]();
				},
				size: function() {
					return this.m_data.size;
				},
				insert: function(key, value) {
					this.m_data.set(key, value);
				},
				set: function(key, value) {
					this.m_data.set(key, value);
				},
				count: function(key) {
					return this.m_data.has(key);
				},
				at: function(key) {
					return this.m_data.get(key);
				},
				each: function(cb) {
					this.m_data.forEach(cb);
				},
				erase: function(key) {
					this.m_data.delete(key);
				},
				clear: function() {
					this.m_data .clear();
				}
			}
		},
		SimpleSet: function() {
			return {
				m_data: new Set(),
				"Symbol.iterator": function() {
					return this.m_data["Symbol.iterator"]();
				},
				values: function () {
					return this.m_data;
				},
				begin: function() {
					this["Symbol.iterator"]();
				},
				size: function () {
					return this.size;
				},
				count: function (key) {
					return this.m_data.has(key);
				},
				erase: function (key) {
					this.m_data.delete(key);
				},
				clear: function () {
					this.m_data.clear();
				},
				insert: function(key) {
					this.m_data.add(key);
				},
				insertArray: function(arrayOfKeys) {
					for(var i in arrayOfKeys) {
						this.m_data.insert(arrayOfKeys[i]);
					}
				},
				each: function(cb) {
					this.m_data.forEach(cb);
				},
				toArray: function() {
					var tmp = [];
					for(var i in this.m_data) {
						tmp.push(i);
					}
					return tmp;
				},
				equal: function(other) {
					if (this.size() != other.size()) {
						return false;
					}
					for(let i of this.m_data) {
						if (!other.count(i)) {
							return false;
						}
					}
				return true;
				}
			}
		},
		
		getMissing: function(setA, setB, missingInA, missingInB) {
			for(let id of setA.values()) {
				if (!setB.count(id)) {
					missingInB.insert(id);
				}
			}
			for(let id of setB.values()) {
				if (!setA.count(id)) {
					missingInA.insert(id);
				}
			}
		},
		
		toIntArray: function(strArray) {
			var tmp = [];
			for(var i in strArray) {
				tmp.push(parseInt("" + strArray[i]));
			}
			return tmp;
		},
	   
        /**
         * Calculates the overlap of the viewport and a bbox. Returns the percentage of overlap.
         *
         * @param map contains the viewport coordinates
         * @param bbox
         * @returns {number} defines the overlap (0 <= overlap <= 1)
         */
        percentOfOverlap: function (map, bbox) {
            if (bbox) {
                // basic version: http://math.stackexchange.com/questions/99565/simplest-way-to-calculate-the-intersect-area-of-two-rectangles
                var viewport = map.getBounds();
                var d0 = map.project(viewport.getSouthWest()),
                    w0 = Math.abs(map.project(viewport.getNorthEast()).x - d0.x), // width
                    h0 = Math.abs(map.project(viewport.getNorthEast()).y - d0.y), // height

                    d1 = map.project(bbox[0]),
                    w1 = Math.abs(map.project(bbox[1]).x - d1.x), // width
                    h1 = Math.abs(map.project(bbox[1]).y - d1.y), // height

                    x11 = d0.x,
                    y11 = d0.y,
                    x12 = d0.x + w0,
                    y12 = d0.y - h0,
                    x21 = d1.x,
                    y21 = d1.y,
                    x22 = d1.x + w1,
                    y22 = d1.y - h1,

                    xOverlap = Math.max(0, Math.min(x12, x22) - Math.max(x11, x21)),
                    yOverlap = Math.max(0, Math.min(y11, y21) - Math.max(y12, y22)),
                    totalOverlap = xOverlap * yOverlap;

                return totalOverlap / (w0 * h0); // compare the overlap to the size of the viewport
            } else {
                return 0;
            }
        },

        /**
         * Timer-utility for benchmarking, logs on the console.
         *
         * @param name of the timer
         * @returns {{stop: Function} stops the timer}
         */
        timer: function (name) {
            return {
				m_start : new Date(),
				m_end: undefined,
				m_name: name,
				start: function() {
					this.m_start = new Date();
				},
                stop: function () {
                    this.m_end = new Date();
                    var time = this.m_end.getTime() - this.m_start.getTime();
                    console.log('Timer:', this.m_name, 'finished in', time, 'ms');
                }
            }
        },
	   
		AsyncCallBackHandler: function(targetCount, cb) {
			return h = {
				m_tc: targetCount,
				m_cc: 0,
				m_cb: cb,
				inc: function() {
					h.m_cc += 1;
					if (h.m_cc >= h.m_tc) {
						h.m_cb();
					}
				}
			};
		},

        /**
         * adds a string to the search input
         *
         * @param qstr the string that should be added
         */
        addSingleQueryStatementToQuery: function (qstr) {
            var search_text = $('#search_text');
			search_text.tokenfield('createToken', qstr);
//             search_text.change();
        },
	   
		setQuery: function(qstr) {
            var search_text = $('#search_text');
			search_text.tokenfield('setTokens', [{value : qstr, label : qstr}]);
		},

        //https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
        getParameterByName: function (name) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                results = regex.exec(location.search);
            return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
        },
        
        defErrorCB: function(textStatus, errorThrown) {
			console.log("xmlhttprequest error textstatus=" + textStatus + "; errorThrown="+errorThrown);
			if (confirm("Error occured. Refresh automatically?")) {
				location.reload();
			}
		},
		//this is from https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
		generateUUID: function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
				return v.toString(16);
			});
		},
		generateDocumentUniqueId: function() {
			while(true) {
				var uuid = tools.generateUUID();
				if (!$(uuid).length) {
					return uuid;
				}
			}
		},
		assert: function(v) {
			if (v !== true) {
				throw new Error();
			}
		}
    };

    return tools;
});

