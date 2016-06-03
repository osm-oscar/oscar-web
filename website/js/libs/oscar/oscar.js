/*the config has to have a property named url defining the url to the completer*/
define(['jquery', 'sserialize', 'leaflet', 'module', 'tools'], function (jQuery, sserialize, L, module, tools) {

    /** Code from http://www.artandlogic.com/blog/2013/11/jquery-ajax-blobs-and-array-buffers/
     * Register ajax transports for blob send/recieve and array buffer send/receive via XMLHttpRequest Level 2
     * within the comfortable framework of the jquery ajax request, with full support for promises.
     *
     * Notice the +* in the dataType string? The + indicates we want this transport to be prepended to the list
     * of potential transports (so it gets first dibs if the request passes the conditions within to provide the
     * ajax transport, preventing the standard transport from hogging the request), and the * indicates that
     * potentially any request with any dataType might want to use the transports provided herein.
     *
     * Remember to specify 'processData:false' in the ajax options when attempting to send a blob or arraybuffer -
     * otherwise jquery will try (and fail) to convert the blob or buffer into a query string.
     */
    jQuery.ajaxTransport("+*", function (options, originalOptions, jqXHR) {
        // Test for the conditions that mean we can/want to send/receive blobs or arraybuffers - we need XMLHttpRequest
        // level 2 (so feature-detect against window.FormData), feature detect against window.Blob or window.ArrayBuffer,
        // and then check to see if the dataType is blob/arraybuffer or the data itself is a Blob/ArrayBuffer
        if (window.FormData && ((options.dataType && (options.dataType === 'blob' || options.dataType === 'arraybuffer')) ||
                (options.data && ((window.Blob && options.data instanceof Blob) ||
                (window.ArrayBuffer && options.data instanceof ArrayBuffer)))
            )) {
            return {
                /**
                 * Return a transport capable of sending and/or receiving blobs - in this case, we instantiate
                 * a new XMLHttpRequest and use it to actually perform the request, and funnel the result back
                 * into the jquery complete callback (such as the success function, done blocks, etc.)
                 *
                 * @param headers
                 * @param completeCallback
                 */
                send: function (headers, completeCallback) {
                    var xhr = new XMLHttpRequest(),
                        url = options.url || window.location.href,
                        type = options.type || 'GET',
                        dataType = options.dataType || 'text',
                        data = options.data || null,
                        async = options.async || true,
                        key;

                    xhr.addEventListener('load', function () {
                        var response = {}, status, isSuccess;

                        isSuccess = xhr.status >= 200 && xhr.status < 300 || xhr.status === 304;

                        if (isSuccess) {
                            response[dataType] = xhr.response;
                        } else {
                            // In case an error occured we assume that the response body contains
                            // text data - so let's convert the binary data to a string which we can
                            // pass to the complete callback.
                            response.text = String.fromCharCode.apply(null, new Uint8Array(xhr.response));
                        }

                        completeCallback(xhr.status, xhr.statusText, response, xhr.getAllResponseHeaders());
                    });

                    xhr.open(type, url, async);
                    xhr.responseType = dataType;

                    for (key in headers) {
                        if (headers.hasOwnProperty(key)) xhr.setRequestHeader(key, headers[key]);
                    }
                    xhr.send(data);
                },
                abort: function () {
                    jqXHR.abort();
                }
            };
        }
    });
	//This is a simple data store to request indexed data from remote by ajax calls
	//It tries to minimize the number of requests made by caching former results
	//USAGE: derive from this and add a function _getData(callback=function(data, remoteRequestId), remoteRequestId) which does the request
	//where data is of the form {dataId: dataEntry}
	var IndexedDataStore = function() {
		this.m_data = tools.SimpleHash(); //maps from id -> data
		this.m_inFlight = tools.SimpleHash(); //maps from id -> remoteRequestId
		this.m_requestCount = 0;
		this.m_remoteRequestCount = 0;
		//the maximum number of data entries to fetch in a single remote request
		this.maxSingleRemoteRequestSize = 100;
		this._acquireRemoteRequestId = function() {
			var ret = this.m_remoteRequestCount;
			this.m_remoteRequestCount += 1;
			return ret;
		};
		this._releaseRemoteRequestId = function() {
			;
		};
		this._acquireRequestId = function() {
			var ret = this.m_requestCount;
			this.m_requestCount += 1;
			return ret;
		};
		this._releaseRequestId = function() {
			;
		};
		
		//maps from requestId -> { cb: callback-function, dataIds: [<int>], inFlightDeps: tools.SimpleSet()} 
		this.m_requests = tools.SimpleHash(); 
		this.m_remoteRequests = tools.SimpleHash(); //maps from remoteRequestId -> {id : remoteRequestId, deps: [requestId], dataIds: [<int>]}
		
		this._remoteRequestDataIds = function(remoteRequestId) {
			if (this.m_remoteRequests.count(remoteRequestId)) {
				return this.m_remoteRequests.at(remoteRequestId).dataIds;
			}
			return [];
		};
		this._requestFromStore = function(cb, dataIds) {
			res = [];
			for(var i in dataIds) {
				res.push(this.m_data.at(dataIds[i]));
			}
			cb(res);
		};
		//data is of the form {dataId: dataEntry}
		this._handleReturnedRemoteRequest = function(remoteRequestId, data) {
			var myRemoteRequest = this.m_remoteRequests.at(remoteRequestId);
			var dataIds = myRemoteRequest.dataIds;
			//insert the data and remove it from in-flight cache
			for(var i in dataIds) {
				var dataId = dataIds[i];
				this.m_data.insert(dataIds[i], data[dataId]);
				this.m_inFlight.erase(dataId);
			}
			//take care of all requests that depend on this remote request
			var myRequestsIds = myRemoteRequest.deps;
			for(var i in myRequestsIds) {
				var requestId = myRequestsIds[i];
				var myRequest = this.m_requests.at(requestId);
				myRequest.inFlightDeps.erase(remoteRequestId);
				if (!myRequest.inFlightDeps.size()) {
					myRequest.cb();
					this.m_requests.erase(requestId);
					this._releaseRequestId(requestId);
				}
			}
			
			//remove this remote request
			this.m_remoteRequests.erase(remoteRequestId);
			this._releaseRemoteRequestId(remoteRequestId);
		};
		//calls cb if all data entries were fetched
		this.fetch = function(cb, dataIds) {
			//first check if we already have the requested data available
			var missingIds = [];
			for(var i in dataIds) {
				if (!this.count(dataIds[i])) {
					missingIds.push(dataIds[i]);
				}
			}
			if (!missingIds.length) {
				this._requestFromStore(cb, dataIds);
				return;
			}
			
			var me = this;
			var myRequest = {
				cb: cb,
				requestId: this._acquireRequestId(),
				inFlightDeps: tools.SimpleSet()
			};
			
			//now check if any of the missing ids are in flight
			var stillMissingIds = [];
			for(var i in missingIds) {
				if (this.m_inFlight.count(missingIds[i])) {
					myRequest.inFlightDeps.insert(this.m_inFlight.at(missingIds[i]));
				}
				else {
					stillMissingIds.push(missingIds[i]);
				}
			}
			
			//check if we need to issue our own remote requests
			//we have to split these into this.maxSingleRemoteRequestSize
			var myRemoteRequests = [];
			if (stillMissingIds.length) {
				while(stillMissingIds.length) {
					myRemoteRequestId = this._acquireRemoteRequestId();
					
					var reqSize = Math.min(this.maxSingleRemoteRequestSize, stillMissingIds.length);
					var myMissingIds = stillMissingIds.splice(-reqSize, reqSize);
					
					//put requested dataIds into inflight cache
					for(var i in myMissingIds) {
						this.m_inFlight.insert(myMissingIds[i], myRemoteRequestId);
					}
					
					myRemoteRequests.push(myRemoteRequestId);
					
					myRequest.inFlightDeps.insert(myRemoteRequestId);
					this.m_remoteRequests.insert(myRemoteRequestId, {'id': myRemoteRequestId, 'dataIds': myMissingIds, 'deps' : []});
				}
			}
			
			//put request into request store
			this.m_requests.insert(myRequest.requestId, myRequest);
			
			//add request to remoteRequests
			for(var i in myRequest.inFlightDeps.values()) {
				var rrId = myRequest.inFlightDeps.at(i);
				this.m_remoteRequests.at(rrId).deps.push(myRequest.requestId);
			}
			
			//now issue our own requests
			if (myRemoteRequests.length) {
				for(var i in myRemoteRequests) {
					this._getData(function(data, remoteRequestId) {
						me._handleReturnedRemoteRequest(remoteRequestId, data);
					}, myRemoteRequests[i]);
				};
			}
		};
		this.request = function(cb, dataIds) {
			var me = this;
			this.fetch(function() {
				me._requestFromStore(cb, dataIds);
			}, dataIds);
		};
		this.get = function(cb, dataIds) {
			this.request(cb, dataIds);
		};
		this.at = function(dataId) {
			return this.m_data.at(dataId);
		};
		this.count = function(dataId) {
			return this.m_data.count(dataId);
		};
		this.size = function() {
			return this.m_data.size();
		};
	};
	var JsonIndexedDataStore = function(url) {
		var handler = new IndexedDataStore();
		handler.url = url;
		//function that processes the json data and returns the processed data to bring int othe correct form
		handler._processJson = function(json) {
			return json;
		};
		handler._getData = function(cb, remoteRequestId) {
			var me = handler;
			var dataIds = handler._remoteRequestDataIds(remoteRequestId);
			var params = {};
			if (handler.extraParams !== undefined) {
				for(var i in handler.extraParams) {
					params[i] = handler.extraParams[i];
				}
			}
			params['which'] = JSON.stringify(tools.toIntArray(dataIds));
			jQuery.ajax({
				type: "POST",
				url: this.url,
				data: params,
				mimeType: 'text/plain',
				success: function (plain) {
					try {
						json = JSON.parse(plain);
					}
					catch (err) {
						tools.defErrorCB("Parsing Json Failed", err);
						return;
					}
					cb(me._processJson(json), remoteRequestId);
				},
				error: function (jqXHR, textStatus, errorThrown) {
					tools.defErrorCB(textStatus, errorThrown);
				}
			});
		};
		return handler;
	};
	
	var ShapeCache = function(completerBaseUrl) {
		return JsonIndexedDataStore(completerBaseUrl + "/itemdb/multipleshapes");
	};
	
	//before usage you have to add a function _itemFromJson(json) -> Item
	var ItemCache = function(completerBaseUrl) {
		var handler = JsonIndexedDataStore(completerBaseUrl + "/itemdb/multiple");
		handler.extraParams = {'shape' : 'false'};
		handler._processJson = function(json) {
			var myMap = {};
			for(var i in json) {
				myMap[json[i].id] = handler._itemFromJson(json[i]);
			}
			return myMap;
		};
		return handler;
	};

	var ItemIndexCache = function(completerBaseUrl) {
		var handler = new IndexedDataStore();
		handler.url = completerBaseUrl + "/indexdb/multiple";
		handler._getData = function(cb, remoteRequestId) {
			var dataIds = handler._remoteRequestDataIds(remoteRequestId);
			jQuery.ajax({
				type: "POST",
				url: handler.url,
				data: {'which' : JSON.stringify(tools.toIntArray(dataIds))},
				dataType: 'arraybuffer',
				mimeType: 'application/octet-stream',
				success: function (data) {
					idcs = sserialize.itemIndexSetFromRaw(data);
					idxMap = {};
					for (i = 0; i < idcs.length; ++i) {
						var idx = idcs[i];
						idxMap[idxId] = idx;
					}
					cb(idxMap, remoteRequestId);
				},
				error: function (jqXHR, textStatus, errorThrown) {
					tools.defErrorCB(textStatus, errorThrown);
				}
			});
		};
		return handler;
	};
	
	var CellIndexIdCache = function(completerBaseUrl) {
		var handler = new IndexedDataStore();
		handler.url = completerBaseUrl + "/indexdb/cellindexids";
		handler._getData = function(cb, remoteRequestId) {
			var dataIds = handler._remoteRequestDataIds(remoteRequestId);
			jQuery.ajax({
				type: "POST",
				url: handler.url,
				data: {'which' : JSON.stringify(tools.toIntArray(dataIds)) },
				dataType: 'arraybuffer',
				mimeType: 'application/octet-stream',
				success: function (data) {
					tmp = sserialize.asArray(data, 'uint32');
					myMap = {};
					for (i = 0; i < tmp.length; ++i) {
						myMap[dataIds[i]] = tmp[i];
					}
					cb(myMap, remoteRequestId);
				},
				error: function (jqXHR, textStatus, errorThrown) {
					tools.defErrorCB(textStatus, errorThrown);
				}
			});
		};
		return handler;
	};
	
    var oscarObject = {

        completerBaseUrl: module.config().url,
        maxFetchItems: 100,
        maxFetchShapes: 100,
        maxFetchIdx: 100,
        cqrCounter: 0,
        itemCache: ItemCache(module.config().url),
        shapeCache: ShapeCache(module.config().url),
        idxCache: ItemIndexCache(module.config().url),
        cellIdxIdCache: CellIndexIdCache(module.config().url),
        cqrOps: {'(': '(', ')': ')', '+': '+', '-': '-', '/': '/', '^': '^'},
        cqrParseSkip : {' ' : ' ', '!' : '!', '#' : '#'},
        cqrRegExpEscapes: {
            '*': '*',
            '(': '(',
            ')': ')',
            '|': '|',
            '.': '.',
            '^': '^',
            '$': '$',
            '[': ']',
            ']': ']',
            '-': '-',
            '+': '+',
            '?': '?',
            '{': '}',
            '}': '}',
            '=': '=',
            '!': '!'
        }, //*(|.^$)[]-+?{}=!,
        cqrEscapesRegExp: new RegExp("^[\*\(\|\.\^\$\)\[\]\-\+\?\{\}\=\!\,]$"),
	   
		_init: function() {
			var me = this;
			this.itemCache._itemFromJson = function(json) {
				return me.Item(json, me);
			};
		},

        Item: function (d, parent) {

            if (d.shape.t === 4) {
                for (i in d.shape.v.outer) {
                    for (j in d.shape.v.outer[i]) {
                        if (d.shape.v.outer[i][j].length !== 2) {
                            alert("BAM");
                            break;
                        }
                    }
                }
            }

            return {
                data: d,
                p: parent,

                id: function () {
                    return this.data.id;
                },
                osmid: function () {
                    return this.data.osmid;
                },
                type: function () {
                    return this.data.type;
                },
                score: function () {
                    return this.data.score;
                },
                size: function () {
                    return this.data.k.length;
                },
                key: function (pos) {
                    return this.data.k[pos];
                },
                value: function (pos) {
                    return this.data.v[pos];
                },
                name: function () {
                    if (!this.data || !this.data.k)
                        return "";
                    var languageName = window.navigator.userLanguage || window.navigator.language;
                    languageName = "name:" + languageName.substr(0, 2);
                    var namePos = this.data.k.indexOf(languageName);
                    if (namePos === -1) {
                        namePos = this.data.k.indexOf("name");
                    }

                    if (namePos !== -1) {
                        return this.data.v[namePos];
                    }
                    else {
                        return "HAS_NO_NAME";
                    }
                },
                asLeafletItem: function (successCB, errorCB) {
                    if (!this.p.shapeCache.count(this.id())) {
                        try {
                            successCB(this.p.leafletItemFromShape(this.p.shapeCache.at(this.id())));
                        }
                        catch (e) {
                            errorCB("", e);
                        }
                    }
                    else {
                        this.p.fetchShapes([this.id()], function () {
                            this.asLeafletItem(successCB, errorCB);
                        }, errorCB);
                    }
                },
                asDescList: function (dtCssClass, ddCssClass) {
                    var message = "";
                    for (var i = 0; i < this.data.k.length; ++i) {
                        message += '<dt class="' + dtCssClass + '">' + this.data.k[i] + '</dt><dd class="' + ddCssClass + '">' + this.data.v[i] + "</dd>";
                    }
                    return message;
                },
                toRadians: function (p) {
                    return p * Math.PI / 180;
                },
                toDegrees: function (p) {
                    return p * 180 / Math.PI;
                },
                centerPoint: function () {
                    // see http://mathforum.org/library/drmath/view/51822.html for derivation
                    var phi1 = this.toRadians(this.bbox()[0][0]), lambda1 = this.toRadians(this.bbox()[0][1]);
                    var phi2 = this.toRadians(this.bbox()[1][0]);
                    var deltalambda = this.toRadians((this.bbox()[1][1] - this.bbox()[0][1]));

                    var Bx = Math.cos(phi2) * Math.cos(deltalambda);
                    var By = Math.cos(phi2) * Math.sin(deltalambda);

                    var phi3 = Math.atan2(Math.sin(phi1) + Math.sin(phi2),
                        Math.sqrt((Math.cos(phi1) + Bx) * (Math.cos(phi1) + Bx) + By * By));
                    var lambda3 = lambda1 + Math.atan2(By, Math.cos(phi1) + Bx);
                    lambda3 = (lambda3 + 3 * Math.PI) % (2 * Math.PI) - Math.PI; // normalise to -180..+180?

                    return [this.toDegrees(phi3), this.toDegrees(lambda3)];
                },
                //[southWest, northEast]
                bbox: function () {
                    return [[this.data.bbox[0], this.data.bbox[2]], [this.data.bbox[1], this.data.bbox[3]]];
                }
            };
            /*end of item object*/
        },
//sqId is the sequence id of this cqr
        CellQueryResult: function (data, parent, sqId) {
            return {
                d: data,
                p: parent,
                sid: sqId,
                sequenceId: function () {
                    return this.sid;
                },
                regionIndexCache: {},
                isFull: function () {
                    return true;
                },
                hasResults: function () {
                    return this.d.cellInfo.length > 0;
                },
                subSet: function () {
                    return this.d.subSet;
                },
                query: function () {
                    return this.d.query;
                },
                cellPositions: function (regionId, dest) {
                    if (this.subSet().regions[regionId] !== undefined) {
                        var myRegion = this.subSet().regions[regionId];
                        var myCellPositions = myRegion.cellpositions;

                        for (i in myCellPositions) {
                            var cellPosition = myCellPositions[i];
                            dest[cellPosition] = cellPosition;
                        }

                        if (this.subSet().type === 'sparse') {
                            var myChildren = myRegion.children;
                            for (i in myChildren) {
                                this.cellPositions(myChildren[i], dest);
                            }
                        }
                    }
                },
                //get the complete index
                regionItemIndex: function (regionId, successCB, errorCB) {
                    if (this.subSet().regions[regionId] === undefined) {
                        errorCB("", "Invalid region");
                        return;
                    }
                    if (this.regionIndexCache[regionId] !== undefined) {
                        successCB(this.regionIndexCache[regionId]);
                        return;
                    }
                    var result = {};
                    var fMC = [];
                    var idcesToFetch = [];
                    var myRegion = this.subSet().regions[regionId];
                    var myCellPositions = {};
                    this.cellPositions(regionId, myCellPositions);
                    for (i in myCellPositions) {
                        var cellInfo = cqr.cellInfo[myCellPositions[i]];
                        if (cellInfo.fullIndex) {
                            fMC.push(cellInfo.cellId);
                        }
                        else if (!cellInfo.fetched) {
                            idcesToFetch.push(cellInfo.indexId);
                        }
                        else {
                            for (x in cellInfo.index.values) {
                                result[cellInfo.index.values[x]] = 0; //TODO:use a set data structure
                            }
                        }
                    }
                    var myPtr = this;
                    var finalFetch = function (successCB, errorCB) {
                        myPtr.p.getIndexes(idcesToFetch,
                            function (ideces) {
                                for (i in ideces) {
                                    var idx = ideces[i].values;
                                    for (j in idx) {
                                        result[idx[j]] = idx[j];
                                    }
                                }
                                var finalResult = [];
                                for (i in result) {
                                    finalResult.push(parseInt(i));
                                }
                                finalResult.sort();
                                myPtr.regionIndexCache[regionId] = finalResult;
                                successCB(finalResult);
                            },
                            errorCB
                        );
                    };
                    if (fMC.length) {//fetch the cell item index ids first
                        this.p.getCellsItemIndexIds(fMC,
                            function (idxIds) {
                                for (i = 0; i < idxIds.length; ++i) {
                                    idcesToFetch.push(idxIds[i]);
                                }
                                finalFetch(successCB, errorCB);
                            },
                            errorCB
                        );
                    }
                    else {
                        finalFetch(successCB, errorCB);
                    }
                },
                regionItemIds: function (regionId, successCB, errorCB, resultListOffset) {
                    var myPtr = this;
                    this.regionItemIndex(regionId,
                        function (index) {
                            successCB(index.slice(resultListOffset, resultListOffset + myPtr.p.maxFetchItems));
                        },
                        errorCB
                    );
                },
                ohPath: function () {
                    return [];
                },
                ohPathRegions: function () {
                    return [];
                }
            };
        },
//data is sserialize.SimpleCellQueryResult with { 'query' : string, regionId : <int> }
        SimpleCellQueryResult: function (data, parent, sqId) {
            var tmp = {
                p: parent,
                d: data,
                sid: sqId,
                sequenceId: function () {
                    return this.sid;
                },
                isFull: function () {
                    return false;
                },
                query: function () {
                    return this.d.query;
                },
                regionItemIds: function (regionId, successCB, errorCB, resultListOffset) {
                    this.p.simpleCqrItems(this.d.query,
                        function (itemIds) {
                            successCB(regionId, itemIds);
                        },
                        errorCB,
                        this.p.maxFetchItems, regionId, resultListOffset);
                },
                rootRegionChildrenInfo: function () {
                    return this.d.regionInfo[0xFFFFFFFF];
                },
                rootRegionApxItemCount: function () {
                    return this.d.rootRegionApxItemCount;
                },
                //returns [regionIds] in successCB,
                //maxOverlap in percent, prunes regions that overlap with more than maxOverlap percent cells of the currently selected set of children regions
                getMaximumIndependetSet: function (regionId, maxOverlap, successCB, errorCB) {
                    if (regionId === undefined) {
                        regionId = 0xFFFFFFFF;
                    }
                    this.p.simpleCqrMaxIndependentChildren(this.d.query, successCB, errorCB, regionId, maxOverlap, this.d.regionFilter);
                },
                //returning an array in successCB with objects={id : int, apxitems : int}
                //returns rootRegionChildrenInfo if regionId is undefined
                regionChildrenInfo: function (regionId, successCB, errorCB) {
                    if (regionId === undefined) {
                        regionId = 0xFFFFFFFF;
                    }
                    var tmp = this.d.regionInfo[regionId];
                    if (tmp !== undefined) {
                        successCB(tmp);
                    }
                    else {
                        var myPtr = this;
                        this.p.simpleCqrChildren(this.d.query,
                            function (regionInfo) {
                                myPtr.d.regionInfo[regionId] = regionInfo[regionId];
                                successCB(myPtr.d.regionInfo[regionId]);
                            },
                            errorCB,
                            regionId,
                            this.d.regionFilter);
                    }
                },
                hasResults: function () {
                    var tmp = this.d.regionInfo[0xFFFFFFFF];
                    return tmp !== undefined && tmp.length > 0;
                },
                ohPath: function () {
                    return this.d.ohPath;
                },
				inOhPath: function(id) {
					return jQuery.inArray(id, this.ohPath()) != -1;
				},
				//get the dag for this query, this fetches the whole dag
				getDag: function(successCB, errorCB) {
					this.p.getDag(this.d.query, successCB, errorCB, this.d.regionFilter);
				}
            };
            return tmp;
        },
        leafletItemFromShape: function (shape) {
            switch (shape.t) {
                case 1://GeoPoint
                    return L.circle(shape.v, 10.0);
                case 2://GeoWay
                    return L.polyline(shape.v);
                case 3://GeoPolygon
                    return L.polygon(shape.v);
                case 4://geo multi polygon
                    return L.multiPolygon(shape.v.outer);
                default:
                    throw Error("oscar::leafletItemFromShape: invalid shape");
                    return null;
            }
        },
        //shape is a shape from the shapeCache and bbox has to provide a funtion contains(coords)
        intersect: function(bbox, shape) {
			if (shape === undefined || bbox === undefined) {
				return false;
			}
			function containsPts(arrayOfPts) {
				for(var i in arrayOfPts) {
					if (bbox.contains(arrayOfPts[i])) {
						return true;
					}
				}
				return false;
			};
            switch (shape.t) {
                case 1://GeoPoint
                    return bbox.contains(shape.v);
                case 2://GeoWay
                case 3://GeoPolygon
                    return containsPts(shape.v);
				case 4://GeoMultiPolygon
					for(var i in shape.v.outer) {
						if (containsPts(shape.v.outer[i])) {
							return true;
						}
					}
					return false;
                default:
					return false;
            }
		},

///Fetches the items in arrayOfItemIds and puts them into the cache. notifies successCB
        fetchItems: function (arrayOfItemIds, successCB, errorCB) {
			this.itemCache.fetch(successCB, arrayOfItemIds);
        },
        /*
         on success: successCB is called with a single Item instance
         on error: errorCB is called with (textStatus, errorThrown)
         */
        getItem: function (itemId, successCB, errorCB) {
			var me = this;
			this.itemCache.fetch(function() {
				if (me.itemCache.count(itemId)) {
					successCB(me.itemCache.at(itemId));
				}
			}, [itemId]);
        },

        /*
         on success: successCB is called with an array of Items()
         on error: errorCB is called with (textStatus, errorThrown)
         */
        getItems: function (arrayOfItemIds, successCB, errorCB) {
			this.itemCache.get(successCB, arrayOfItemIds)
        },

        fetchShapes: function (arrayOfItemIds, successCB, errorCB) {
			this.shapeCache.fetch(successCB, arrayOfItemIds);
        },
        /*
         on success: successCB is called with an object of shapes: { id : shape-description }
         on error: errorCB is called with (textStatus, errorThrown)
         */
        getShapes: function (arrayOfItemIds, successCB, errorCB) {
			this.shapeCache.get(successCB, arrayOfItemIds);
        },
        /*
         on success: successCB is called with a single Item instance
         on error: errorCB is called with (textStatus, errorThrown)
         */
        getShape: function (itemId, successCB, errorCB) {
			var me = this;
			this.shapeCache.fetch(function() {
				if (me.shapeCache.count(itemId)) {
					successCB(me.shapeCache.at(itemId));
				}
			}, [itemId]);
        },

        fetchIndexes: function (arrayOfIndexIds, successCB, errorCB) {
			this.idxCache.fetch(successCB, arrayOfIndexIds);
        },
        getIndex: function (indexId, successCB, errorCB) {
			var me = this;
			this.idxCache.fetch(function() {
				if (me.idx.count(indexId)) {
					successCB(me.idx.at(indexId));
				}
			}, [indexId]);
        },
        getIndexes: function (arrayOfIndexIds, successCB, errorCB) {
			this.idxCache.get(successCB, arrayOfIndexIds);
        },
        fetchCellsItemIndexIds: function (arrayOfCellIds, successCB, errorCB) {
			this.cellIdxIdCache.fetch(successCB, arrayOfCellIds);
        },
        getCellsItemIndexIds: function (arrayOfCellIds, successCB, errorCB) {
			this.cellIdxIdCache.get(successCB, arrayOfCellIds);
        },
        getItemParentIds: function (itemId, successCB, errorCB) {
            var qpath = this.completerBaseUrl + "/itemdb/itemparents/" + itemId;
            jQuery.ajax({
                type: "GET",
                url: qpath,
                dataType: 'arraybuffer',
                mimeType: 'application/octet-stream',
                success: function (raw) {
                    res = sserialize.asU32Array(raw);
                    successCB(res);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
        getItemsRelativesIds: function (itemId, successCB, errorCB) {
            var qpath = this.completerBaseUrl + "/itemdb/itemrelatives/" + itemId;
            jQuery.ajax({
                type: "GET",
                url: qpath,
                dataType: 'arraybuffer',
                mimeType: 'application/octet-stream',
                success: function (raw) {
                    res = sserialize.asU32Array(raw);
                    successCB(res);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
        /*
         on success: successCB is called with an array of itemids
         */
        getTopKItemIds: function (cqr, cellPositions, k, successCB, errorCB) {
            var params = {};
            params['q'] = cqr.query;
            params['which'] = JSON.stringify(cellPositions);
            params['k'] = k;
            var qpath = this.completerBaseUrl + "/cqr/clustered/items";
            jQuery.ajax({
                type: "POST",
                url: qpath,
                data: params,
                mimeType: 'application/json',
                success: function (jsondesc) {
                    successCB(JSON.parse(jsondesc));
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
		/*
			calls successCB with the DAG in json
		*/
		getDag: function(query, successCB, errorCB, regionFilter) {
			var params = {};
			params['q'] = query;
			params['sst'] = "flatjson";
			if (regionFilter !== undefined) {
				params['rf'] = regionFilter;
			}
			
			var qpath = this.completerBaseUrl + "/cqr/clustered/dag";
			var myPtr = this;
			jQuery.ajax({
				type: "GET",
				url: qpath,
				data: params,
				mimeType: 'text/plain',
				success: function( plain ) {
					try {
						json = JSON.parse(plain);
					}
					catch (err) {
						errorCB("Parsing the dag failed with the following parameters: " + JSON.stringify(params), err);
						return;
					}
					successCB(json);
				},
				error: function(jqXHR, textStatus, errorThrown) {
					errorCB(textStatus, errorThrown);
				}
			});
		},
        /*
         on success: successCB is called with sserialize/ReducedCellQueryResult representing matching cells
         */
        completeReduced: function (query, successCB, errorCB) {
            var params = {};
            params['q'] = query;
            params['sst'] = "binary";
            var qpath = this.completerBaseUrl + "/cqr/clustered/reduced";
            jQuery.ajax({
                type: "GET",
                url: qpath,
                data: params,
                dataType: 'arraybuffer',
                mimeType: 'application/octet-stream',
                success: function (raw) {
                    cqr = sserialize.reducedCqrFromRaw(raw);
                    cqr.query = params['q'];
                    successCB(cqr);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
        /*
         on success: successCB is called with the sserialize/CellQueryResult
         on error: errorCB is called with (textStatus, errorThrown)
         */
        completeFull: function (query, successCB, errorCB) {
            var params = {};
            params['q'] = query;
            params['sst'] = "binary";
            //params['sst'] = "flatjson";
            var qpath = this.completerBaseUrl + "/cqr/clustered/full";
            var myPtr = this;
            var mySqId = this.cqrCounter;
            this.cqrCounter += 1;
            jQuery.ajax({
                type: "GET",
                url: qpath,
                data: params,
                dataType: 'arraybuffer',
                mimeType: 'application/octet-stream',
                success: function (raw) {
                    cqr = sserialize.cqrFromRaw(raw);
                    cqr.query = params['q'];
                    successCB(myPtr.CellQueryResult(cqr, myPtr, mySqId));
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
        completeSimple : function(query, successCB, errorCB, ohf, globalOht, regionFilter) {
            var params = {};
            params['q'] = query;
            if (ohf !== undefined) {
                params['oh'] = ohf;
            }
            if (globalOht) {
                params['oht'] = 'global';
            }
            else {
                params['oht'] = 'relative';
            }
            if (regionFilter !== undefined) {
                params['rf'] = regionFilter;
            }
            
            var qpath = this.completerBaseUrl + "/cqr/clustered/simple";
            var myPtr = this;
            var mySqId = this.cqrCounter;
            this.cqrCounter += 1;
            jQuery.ajax({
                type: "GET",
                url: qpath,
                data: params,
                dataType : 'arraybuffer',
                mimeType: 'application/octet-stream',
                success: function( raw ) {
                    var cqr = sserialize.simpleCqrFromRaw(raw);
                    cqr.query = params['q'];
                    cqr.regionFilter = params['rf'];
                    successCB(myPtr.SimpleCellQueryResult(cqr, myPtr, mySqId));
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
        simpleCqrItems: function (query, successCB, errorCB, numItems, selectedRegion, resultListOffset) {
            var params = {};
            params['q'] = query;
            if (numItems !== undefined) {
                params['k'] = numItems;
            }
            if (resultListOffset !== undefined) {
                params['o'] = resultListOffset;
            }
            if (selectedRegion !== undefined) {
                params['r'] = selectedRegion;
            }
            var qpath = this.completerBaseUrl + "/cqr/clustered/items";
            jQuery.ajax({
                type: "GET",
                url: qpath,
                data: params,
                dataType: 'arraybuffer',
                mimeType: 'application/octet-stream',
                success: function (raw) {
                    itemIds = sserialize.asU32Array(raw);
                    successCB(itemIds);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
        simpleCqrChildren: function (query, successCB, errorCB, selectedRegion, regionFilter) {
            var params = {};
            params['q'] = query;
            if (selectedRegion !== undefined) {
                params['r'] = selectedRegion;
            }
            if (regionFilter !== undefined) {
               params['rf'] = regionFilter;
            }
            var qpath = this.completerBaseUrl + "/cqr/clustered/children";
            jQuery.ajax({
                type: "GET",
                url: qpath,
                data: params,
                dataType: 'arraybuffer',
                mimeType: 'application/octet-stream',
                success: function (raw) {
                    praw = sserialize.asU32Array(raw);
                    var childrenInfo = [];
                    for (var i = 0; i < praw.length; i += 2) {
                        childrenInfo.push({'id': praw[i], 'apxitems': praw[i + 1]});
                    }
                    var res = {};
                    childrenInfo.sort(function (a, b) {
                        return b['apxitems'] - a['apxitems'];
                    });
                    res[selectedRegion] = childrenInfo;
                    successCB(res);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
        simpleCqrMaxIndependentChildren: function (query, successCB, errorCB, selectedRegion, maxOverlap, regionFilter) {
            var params = {};
            params['q'] = query;
            if (selectedRegion !== undefined) {
                params['r'] = selectedRegion;
            }
            if (maxOverlap !== undefined) {
                params['o'] = maxOverlap;
            }
            if(regionFilter !== undefined) {
                params['rf'] = regionFilter;
            }
            var qpath = this.completerBaseUrl + "/cqr/clustered/michildren";
            jQuery.ajax({
                type: "GET",
                url: qpath,
                data: params,
                mimeType: 'application/json',
                success: function (jsondesc) {
                    successCB(jsondesc);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    errorCB(textStatus, errorThrown);
                }
            });
        },
        cqrRexExpFromQuery: function (query) {
            myRegExpStr = "";
            var tokens = [];
            var tokenString = "";
            var qtype = 'substring';
            for (i = 0; i < query.length; ++i) {
                while (this.cqrParseSkip[query[i]] !== undefined || this.cqrOps[query[i]] !== undefined) { //ops and braces
                    ++i;
                }
                if (query[i] === '?') {
                    qtype = 'suffix';
                    ++i;
                }
                if (query[i] === '"') {
                    if (qtype === 'substring') {
                        qtype = 'exact';
                    }
                    ++i;
                    while (i < query.length) {
                        if (query[i] == '\\') {
                            ++i;
                            if (i < query.length) {
                                tokenString += query[i];
                                ++i;
                            }
                            else {
                                break;
                            }
                        }
                        else if (query[i] == '"') {
                            ++i;
                            break;
                        }
                        else {
                            tokenString += query[i];
                            ++i;
                        }
                    }
                    if (i < query.length && query[i] === '?') {
                        if (qtype === 'exact') {
                            qtype = 'prefix';
                        }
                        else { //qtype is suffix
                            qtype = 'substring';
                        }
                        ++i;
                    }
                }
                else {
                    while (i < query.length) {
                        if (query[i] === '\\') {
                            ++i;
                            if (i < query.length) {
                                tokenString += query[i];
                                ++i;
                            }
                            else {
                                break;
                            }
                        }
                        else if (query[i] === ' ' || query[i] === '?') {
                            break;
                        }
                        else if (query[i] === '(' || query[i] === ')') {
                            break;
                        }
                        else if (this.cqrOps[query[i]] !== undefined) {
                            if (tokenString.length && tokenString[tokenString.length - 1] === ' ') {
                                break;
                            }
                            else {
                                tokenString += query[i];
                                ++i;
                            }
                        }
                        else {
                            tokenString += query[i];
                            ++i;
                        }
                    }
                    if (i < query.length && query[i] === '?') {
                        if (qtype === 'exact') {
                            qtype = 'prefix';
                        }
                        else { //qtype is suffix
                            qtype = 'substring';
                        }
                        ++i;
                    }
                }
                tokens.push({value: tokenString, qtype: qtype});
                tokenString = "";
            }
            var totalRegExp = "^(";
            for (i in tokens) {
                var token = tokens[i];
                var tokenRegExp = "";
                var j = 0;
                if (token.value[0] === '@') { //tag query
                    j = 1;
                    if (token.qtype === 'substring') {
                        token.qtype = 'prefix';
                    }
                }
                else {//name query, add name-tagaddr:street
                    tokenRegExp += "((name(:.?.?)?)|ref|int_ref|(addr:(street|city|place|country|hamlet|suburb|subdistrict|district|province|state))):";
                }
                if (token.qtype === 'substring' || token.qtype === 'suffix') {
                    tokenRegExp += ".*";
                }
                for (; j < token.value.length; ++j) {
                    var curChar = token.value[j];
                    var regExpStr = this.cqrEscapesRegExp.toString();
                    if (this.cqrEscapesRegExp.test(curChar)) {
                        tokenRegExp += "\\";
                    }
                    tokenRegExp += token.value[j];
                }
                if (token.qtype === 'substring' || token.qtype === 'prefix') {
                    tokenRegExp += ".*";
                }
                if (totalRegExp[totalRegExp.length - 1] === ')') {
                    totalRegExp += "|";
                }
                totalRegExp += "(" + tokenRegExp + ")";
            }
            totalRegExp += ")$";
            return new RegExp(totalRegExp, "i");
        }

    };
	oscarObject._init();
	return oscarObject;
});
/*end of define and function*/

