define(["jquery"], function ($) {
	
	var check_number_is_number = function(key) {
		if ((parseInt(key) !== key) && (parseInt(key) + "") === key) {
			console.log("number in string")
		}
	};
	
    var tools = {
        /**
         * Represents a small API for a hashmap
         *
         * @returns {{}} hashmap-object
         */
		SimpleHash: function () {
			return {
				m_data: new Map(),
				size: function () {
					return this.m_data.size;
				},
				insert: function (key, value) {
					this.m_data.set(key, value);
				},
				set: function (key, value) {
					this.insert(key, value);
				},
				count: function (key) {
					return this.m_data.has(key);
				},
				at: function (key) {
					return this.m_data.get(key);
				},
				//call cb for each (key, value) with cb(key, value)
				each: function(cb) {
					for(let [key, value] of this.builtinmap()) {
						cb(key, value);
					}
				},
				erase: function (key) {
					this.m_data.delete(key);
				},
				clear: function () {
					this.m_data.clear();
				},
				builtinmap: function() {
					return this.m_data;
				},
				keys: function() {
					return this.builtinmap().keys();
				}
			};
		},
		SimpleSet: function() {
			var ss = tools.SimpleHash();
			ss.m_data = new Set();
			ss.insert = function(key) {
				this.m_data.add(key);
			};
			ss.insertArray = function(arrayOfKeys) {
				for(let x in arrayOfKeys) {
					ss.insert(x);
				}
			};
			ss.each = function(cb) {
				for(let key of this.builtinset()) {
					cb(key);
				}
			};
			ss.toArray = function() {
				var tmp = [];
				for(let x of this.builtinset()) {
					tmp.push(x);
				}
				return tmp;
			};
			ss.equal = function(other) {
				if (this.size() != other.size()) {
					return false;
				}
				for(let key of this.keys()) {
					if (!other.count(key)) {
						return false;
					}
				}
				return true;
			};
			ss["builtinset"] = function() {
				return this.m_data;
			};
			ss.keys = function() {
				return this.builtinset();
			};
			return ss;
		},
		
		getMissing: function(setA, setB, missingInA, missingInB) {
			for(let id of setA.keys()) {
				if (!setB.count(id)) {
					missingInB.insert(id);
				}
			}
			for(let id of setB.keys()) {
				if (!setA.count(id)) {
					missingInA.insert(id);
				}
			}
		},
		partition: function(setA, setB, onlyInB, onlyInA, inBoth) {
			for(let id of setA.keys()) {
				if (!setB.count(id)) {
					onlyInA.insert(id);
				}
				else {
					inBoth.insert(id);
				}
			}
			for(let id of setB.keys()) {
				if (!setA.count(id)) {
					onlyInB.insert(id);
				}
			}
		},
		
		toIntArray: function(strArray) {
			var tmp = [];
			for(let x of strArray) {
				tmp.push(parseInt("" + x));
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

