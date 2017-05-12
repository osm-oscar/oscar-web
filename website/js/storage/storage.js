define(['jquery', 'tools'], function (jQuery, tools) {
	return storage = {
		//This is a simple data store to request indexed data from remote by ajax calls
		//It tries to minimize the number of requests made by caching former results
		//USAGE: derive from this and add a function _getData(callback=function(data, remoteRequestId), remoteRequestId) which does the request
		//where data is of the form {dataId: dataEntry}
		
		//you can change the underlying storage by providing a new class
		//This class has to provide the following functions:
		//size() -> <int>
		//count(id) -> <bool>
		//Furthermore if you do not specialize _requestFromStore():
		//at(id) -> data
		//And if you do not specialize _insertData():
		//insert(id, data) 

		IndexedDataStore: function() {
			return {
				m_data: tools.SimpleHash(), //maps from id -> data
				m_inFlight: tools.SimpleHash(), //maps from id -> remoteRequestId
				m_requestCount: 0,
				m_remoteRequestCount: 0,
				//the maximum number of data entries to fetch in a single remote request
				maxSingleRemoteRequestSize: 100,
				_acquireRemoteRequestId: function() {
					var ret = this.m_remoteRequestCount;
					this.m_remoteRequestCount += 1;
					return ret;
				},
				_releaseRemoteRequestId: function() {
					;
				},
				_acquireRequestId: function() {
					var ret = this.m_requestCount;
					this.m_requestCount += 1;
					return ret;
				},
				_releaseRequestId: function() {
					;
				},
				
				//maps from requestId -> { cb: callback-function, dataIds: [<int>], inFlightDeps: tools.SimpleSet()} 
				m_requests: tools.SimpleHash(), 
				m_remoteRequests: tools.SimpleHash(), //maps from remoteRequestId -> {id : remoteRequestId, deps: [requestId], dataIds: [<int>]}
				
				_remoteRequestDataIds: function(remoteRequestId) {
					if (this.m_remoteRequests.count(remoteRequestId)) {
						return this.m_remoteRequests.at(remoteRequestId).dataIds;
					}
					return [];
				},
				
				//you may overload this to change the way a request is fullfilled
				_requestFromStore: function(cb, dataIds) {
					res = [];
					for(let x of dataIds) {
						res.push(this.m_data.at(x));
					}
					cb(res);
				},
				
				//dataIds is of the form [dataId]
				//data is of the form {dataId: dataEntry}
				//you may overload this to change the way data is inserted into the storage
				_insertData: function(dataIds, data) {
					for(let dataId of dataIds) {
						this.m_data.insert(dataId, data[dataId]);
					}
				},
				
				//data is of the form {dataId: dataEntry}
				_handleReturnedRemoteRequest: function(remoteRequestId, data) {
					var myRemoteRequest = this.m_remoteRequests.at(remoteRequestId);
					var dataIds = myRemoteRequest.dataIds;
					//insert the data and remove it from in-flight cache
					this._insertData(dataIds, data);
					for(let dataId of dataIds) {
						this.m_inFlight.erase(dataId);
					}
					//take care of all requests that depend on this remote request
					var myRequestsIds = myRemoteRequest.deps;
					for(let requestId of myRequestsIds) {
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
				},
				//calls cb if all data entries were fetched
				fetch: function(cb, dataIds) {
					//first check if we already have the requested data available
					var missingIds = [];
					for(let dataId of dataIds) {
						if (!this.count(dataId)) {
							missingIds.push(dataId);
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
					for(let missingId of missingIds) {
						if (this.m_inFlight.count(missingId)) {
							myRequest.inFlightDeps.insert(this.m_inFlight.at(missingId));
						}
						else {
							stillMissingIds.push(missingId);
						}
					}
					
					//check if we need to issue our own remote requests
					//we have to split these into this.maxSingleRemoteRequestSize
					var myRemoteRequests = [];
					if (stillMissingIds.length) {
						while(stillMissingIds.length) {
							var myRemoteRequestId = this._acquireRemoteRequestId();
							
							var reqSize = Math.min(this.maxSingleRemoteRequestSize, stillMissingIds.length);
							var myMissingIds = stillMissingIds.splice(-reqSize, reqSize);
							
							//put requested dataIds into inflight cache
							for(let missingId of myMissingIds) {
								this.m_inFlight.insert(missingId, myRemoteRequestId);
							}
							
							myRemoteRequests.push(myRemoteRequestId);
							
							myRequest.inFlightDeps.insert(myRemoteRequestId);
							this.m_remoteRequests.insert(myRemoteRequestId, {'id': myRemoteRequestId, 'dataIds': myMissingIds, 'deps' : []});
						}
					}
					
					//put request into request store
					this.m_requests.insert(myRequest.requestId, myRequest);
					
					//add request to remoteRequests
					for(let rrId of myRequest.inFlightDeps.builtinset()) {
						this.m_remoteRequests.at(rrId).deps.push(myRequest.requestId);
					}
					
					//now issue our own requests
					if (myRemoteRequests.length) {
						for(let x of myRemoteRequests) {
							this._getData(function(data, remoteRequestId) {
								me._handleReturnedRemoteRequest(remoteRequestId, data);
							}, x);
						};
					}
				},
				request: function(cb, dataIds) {
					var me = this;
					this.fetch(function() {
						me._requestFromStore(cb, dataIds);
					}, dataIds);
				},
				get: function(cb, dataIds) {
					this.request(cb, dataIds);
				},
				at: function(dataId) {
					return this.m_data.at(dataId);
				},
				count: function(dataId) {
					return this.m_data.count(dataId);
				},
				size: function() {
					return this.m_data.size();
				}
			};
		}, //end function
		JsonIndexedDataStore: function(url) {
			var handler = storage.IndexedDataStore();
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
		}
	};
});
