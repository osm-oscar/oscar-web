define(["require", "state", "jquery", "search", "tools"],
    function (require, state, $, search, tools) {
        var kvClustering = {
            closeClustering: function(queryWithoutRefinements){
                console.log("queryWithoutRefinements",queryWithoutRefinements);
                console.log("lastQueryWithoutRefinements",state.clustering.lastQueryWithoutRefinements);
                if(queryWithoutRefinements!==state.clustering.lastQueryWithoutRefinements){
                    state.clustering.activeRefinements = [];
                    state.clustering.lastQueryWithoutRefinements = queryWithoutRefinements;
                }
                $('#kv-content').removeClass('show active');
                $('#p-content').removeClass('show active');
                $('#k-content').removeClass('show active');
                $('.nav-item.refinement-type.active').removeClass('active');
                state.clustering = {
                    kvQueryId : state.clustering.kvQueryId,
                    kQueryId : state.clustering.kQueryId,
                    pQueryId : state.clustering.pQueryId,
                    kRefinements : tools.SimpleHash(), // keyId -> {name : String, itemCount: int}
                    pRefinements : tools.SimpleHash(), // parentId -> {name : String, itemCount: int}
                    kvRefinements : tools.SimpleHash(), // "{keyId: int, valueId: int}" -> {name: String, itemCount: int}
                    activeRefinements: state.clustering.activeRefinements,
                    kvExceptions: tools.SimpleHash(), // "{keyId: int, valueId: int}" -> {name : String, itemCount: int}
                    kExceptions: tools.SimpleHash(), // keyId -> {name: String, itemCount: int}
                    kDebugInfo: {},
                    pDebugInfo: {},
                    kvDebugInfo: {},
                    debug: state.clustering.debug,
                    lastKvQuery: state.clustering.lastKvQuery,
                    lastKQuery: state.clustering.lastKQuery,
                    lastPQuery: state.clustering.lastPQuery,
                    lastQueryWithoutRefinements: state.clustering.lastQueryWithoutRefinements,
                };
                kvClustering.drawKRefinements();
                kvClustering.drawPRefinements();
                kvClustering.drawKvRefinements();
                kvClustering.drawKExceptions();
                kvClustering.drawKvExceptions();
                kvClustering.drawActiveRefinements();
                kvClustering.drawKvDebugInfo();
                kvClustering.drawKDebugInfo();
                kvClustering.drawPDebugInfo();
            },

            drawKRefinements: function(){
                const kClusteringList = $("#kClustering-list");
                kClusteringList.empty();
                let added = false;
                state.clustering.kRefinements.each(function(key, value){
                    added = true;
                    kClusteringList.append(
                        `<li class="list-group-item d-flex justify-content-between align-items-center"><a class="refinement" id=@${value.name} href="#">${value.name}</a>
                                                <a class="kRefinement-exception" id=${key} href="#">(ignore)</a><span class = "badge badge-primary badge-pill">${value.itemCount}</span>
                                                </li>`) ;
                });
                if(!added)
                    kClusteringList.append(`No refinements for this query.`);
            },
            drawPRefinements: function(){
                const pClusteringList = $("#pClustering-list");
                pClusteringList.empty();
                state.clustering.pRefinements.each(function(key, value){
                    pClusteringList.append(
                        `<li  class="list-group-item d-flex justify-content-between align-items-center"><a class="refinement" id="&quot;${value.name}&quot;" href="#">${value.name}</a><span class = "badge badge-primary badge-pill">${value.itemCount}</span></li>`) ;
                });
                if(state.clustering.pRefinements.size() === 0)
                    pClusteringList.append(`No refinements for this query.`);
            },
            drawKvRefinements: function(){
                const kvClusteringList = $("#kvClustering-list");
                kvClusteringList.empty();
                state.clustering.kvRefinements.each(function(key, value){
                    key = JSON.parse(key);
                    kvClusteringList.append(
                        `<li class="list-group-item d-flex justify-content-between align-items-center">
                                <a class="refinement" id=@${value.name} href="#">${value.name}</a>
                                                <a class="kvRefinement-exception" id="${key.keyId}:${key.valueId}" href="#">(ignore)</a>
                                                <span class = "badge badge-primary badge-pill">${value.itemCount}</span>
                         </li>`) ;
                });
                if(state.clustering.kvRefinements.size() === 0)
                    kvClusteringList.append(`No refinements for this query.`);
            },

            drawLoadingPlaceholders: function(count, minWidth, maxWidth, mode){
                const refinementList = $('#'+mode+'Clustering-list');
                refinementList.empty();
                const  refinementLoading = $('.'+mode+'Refinement-loading');
                refinementLoading.removeClass('hidden');
                refinementLoading.empty();
                for(let i = 0; i< count; i++){
                    refinementLoading.append(`<li class="list-group-item d-flex justify-content-between align-items-center">
                                        <div class="refinement-loading--refinement" style="width: ${minWidth+Math.floor(Math.random() * maxWidth)}px"></div>
                                        </li>`);
                }
            },

            fetchKRefinements: function(query, force){
                let exceptionString = "[";
                state.clustering.kExceptions.each(function (key, value) {
                    exceptionString += key + ",";
                });
                exceptionString += "]";
                state.clustering.kQueryId++;
                let queryRequestWithoutId = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level"
                    + "&type=k&maxRefinements=10" + exceptionString+ '&debug=' + state.clustering.debug;

                let queryRequestWithId = queryRequestWithoutId + "&queryId=" + state.clustering.kQueryId;

                if(queryRequestWithoutId===state.clustering.lastKQuery)
                    return;

                state.clustering.kRefinements = tools.SimpleHash();
                state.clustering.kDebugInfo = {};
                kvClustering.drawKDebugInfo();
                kvClustering.drawKRefinements();
                kvClustering.drawLoadingPlaceholders(11, 75, 125, 'k');
                state.clustering.lastKQuery = queryRequestWithoutId;


                $.ajax({
                    type: "GET",
                    url: "/oscar/kvclustering/get",
                    data: {'q' : kvClustering.addRefinementToQuery(query),
                           'rf' : 'admin_level',
                        'type': 'k',
                        'maxRefinements' : 10,
                        'exceptions' : exceptionString,
                        'debug' : state.clustering.debug,
                        'queryId' : state.clustering.kQueryId
                    },
                    dataType: 'JSON',
                    mimeType: 'application/JSON',
                    success: function (data) {
                        if(state.clustering.kQueryId!==data.queryId && !force)
                            return;

                        data.clustering.forEach(function(key){
                            state.clustering.kRefinements.insert( key.id, {name: key.name, itemCount: key.itemCount});
                        });
                        if(state.clustering.debug){
                            state.clustering.kDebugInfo = data.debugInfo;
                            kvClustering.drawKDebugInfo();
                        }
                        $('.kRefinement-loading').empty();
                        kvClustering.drawKRefinements();
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        tools.defErrorCB(textStatus, errorThrown);
                    }
                });
            },

            fetchPRefinements: function(query, force){
                let queryRequestWithoutId = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level"
                    + "&type=p&maxRefinements=10"+ '&debug=' + state.clustering.debug;
                if(state.clustering.lastPQuery === queryRequestWithoutId)
                    return;
                state.clustering.pQueryId++;
                let queryRequestWithId = queryRequestWithoutId +"&queryId=" + state.clustering.pQueryId;
                state.clustering.pRefinements = tools.SimpleHash();
                kvClustering.drawPRefinements();
                state.clustering.pDebugInfo = {};
                kvClustering.drawPDebugInfo();
                kvClustering.drawLoadingPlaceholders(11, 100, 150, 'p');
                state.clustering.lastPQuery = queryRequestWithoutId;
                $.get(queryRequestWithId, function (data) {

                });
                $.ajax({
                    type: "GET",
                    url: "/oscar/kvclustering/get",
                    data: {'q' : kvClustering.addRefinementToQuery(query),
                        'rf' : 'admin_level',
                        'type': 'p',
                        'maxRefinements' : 10,
                        'debug' : state.clustering.debug,
                        'queryId' : state.clustering.pQueryId
                    },
                    dataType: 'JSON',
                    mimeType: 'application/JSON',
                    success: function (data) {
                        state.clustering.pRefinements = tools.SimpleHash();
                        if(state.clustering.pQueryId!==data.queryId && !force)
                            return;

                        data.clustering.forEach(function(parent){
                            state.clustering.pRefinements.insert( parent.id, {name: parent.name, itemCount: parent.itemCount});
                        });
                        if(state.clustering.debug){
                            state.clustering.pDebugInfo = data.debugInfo;
                            kvClustering.drawPDebugInfo();
                        }
                        $('.pRefinement-loading').empty();
                        kvClustering.drawPRefinements();
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        tools.defErrorCB(textStatus, errorThrown);
                    }
                });
            },

            fetchKvRefinements: function(query, force){
                let exceptionString = "[";
                state.clustering.kvExceptions.each(function (key, value) {
                    key = JSON.parse(key);
                    exceptionString += "["  + key.keyId + "," + key.valueId + "],";
                });
                exceptionString += "]";

                let queryRequestWithoutId = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level"
                    + "&type=kv&maxRefinements=10" + exceptionString + '&debug=' + state.clustering.debug;
                if(queryRequestWithoutId===state.clustering.lastKvQuery)
                    return;
                state.clustering.kvQueryId++;
                let queryRequestWithId = queryRequestWithoutId +  "&queryId=" + state.clustering.kvQueryId;
                state.clustering.kvDebugInfo = {};
                state.clustering.kvRefinements = tools.SimpleHash();
                state.clustering.kvDebugInfo = {};
                kvClustering.drawKvDebugInfo();
                kvClustering.drawKvRefinements();
                kvClustering.drawLoadingPlaceholders(11, 100, 150, 'kv');
                state.clustering.lastKvQuery = queryRequestWithoutId;
                $.ajax({
                    type: "GET",
                    url: "/oscar/kvclustering/get",
                    data: {'q' : kvClustering.addRefinementToQuery(query),
                        'rf' : 'admin_level',
                        'type': 'kv',
                        'maxRefinements' : 10,
                        'exceptions' : exceptionString,
                        'debug' : state.clustering.debug,
                        'queryId' : state.clustering.kvQueryId
                    },
                    dataType: 'JSON',
                    mimeType: 'application/JSON',
                    success: function (data) {
                        state.clustering.kvRefinements = tools.SimpleHash();
                        if(state.clustering.kvQueryId!==data.queryId && !force)
                            return;

                        data.clustering.forEach(function(keyValueData){
                            state.clustering.kvRefinements.insert( JSON.stringify({keyId: keyValueData.keyId, valueId: keyValueData.valueId}), {name: keyValueData.name, itemCount: keyValueData.itemCount});
                        });
                        if(state.clustering.debug){
                            console.log(data.debugInfo);
                            state.clustering.kvDebugInfo = data.debugInfo;
                            kvClustering.drawKvDebugInfo();
                        }
                        $('.kvRefinement-loading').empty();
                        kvClustering.drawKvRefinements();
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        tools.defErrorCB(textStatus, errorThrown);
                    }
                });
            },

            addRefinementToQuery: function(query) {
                let refinementString = "";
                state.clustering.activeRefinements.forEach(function (refinementName) {
                    refinementString += unescape(refinementName) + " ";
                });
                return refinementString + query;
            },

            addRefinement: function(refinementName){
                state.clustering.activeRefinements.push(escape(refinementName));
                console.log(state.clustering.activeRefinements);
                kvClustering.drawActiveRefinements();
            },
            drawActiveRefinements: function() {
                const refinements = $('#refinements');
                refinements.empty();
              state.clustering.activeRefinements.forEach(function (refinementName){
                  const escapedName = refinementName;
                  refinementName = unescape(refinementName);
                  refinements.append(`<span class="badge badge-primary "><span class="active-refinement" style="cursor: pointer" id=${escapedName} >x</span> ${refinementName}</span>`);
              });
            },
            // addRefinement: function(refinement){
            //
            //     let clusteringType = $('#refinement_type option:selected').val();
            //
            //     if(clusteringType === 'p'){
            //         $('#refinements').append(`<span class="badge badge-primary active-refinement">&quot;${refinement}&quot;</span>`);
            //     } else {
            //         $('#refinements').append(`<span class="badge badge-primary active-refinement">@${refinement}</span>`);
            //     }
            // },
            addKException: function(refinement){
                state.clustering.kExceptions.insert(parseInt(refinement), state.clustering.kRefinements.at(parseInt(refinement)));
                kvClustering.fetchKRefinements(kvClustering.addRefinementToQuery($("#search_text").val(), true));
            },
            addKvException: function(refinement){
                let keyValue = refinement.split(":");
                let keyValueObject = {keyId: parseInt(keyValue[0]), valueId: parseInt(keyValue[1])};
                //stringify object because object comparison does not work in javascript
                keyValueObject = JSON.stringify(keyValueObject);
                state.clustering.kvExceptions.insert(keyValueObject, state.clustering.kvRefinements.at(keyValueObject));
                kvClustering.fetchKvRefinements(kvClustering.addRefinementToQuery($("#search_text").val(), true));
            },
            drawKExceptions: function(){
                const kExceptionList = $('#kException-list');
                kExceptionList.empty();
                if(state.clustering.kExceptions.size() > 0){
                    $('#kExceptionText').show();
                } else {
                    $('#kExceptionText').hide();
                }
                state.clustering.kExceptions.each(function (key, value) {
                    kExceptionList.append(`<li><a class="active-exception" id="${key}" href="#">${value.name}</a></li>`);
                })
            },
            drawKvExceptions: function(){
                const kvExceptionList = $('#kvException-list');
                kvExceptionList.empty();
                if(state.clustering.kvExceptions.size() > 0){
                    $('#kvExceptionText').show();
                } else {
                    $('#kvExceptionText').hide();
                }
                state.clustering.kvExceptions.each(function (key, value) {
                    key = JSON.parse(key);
                    kvExceptionList.append(`<li><a class="active-exception" id="${key.keyId}:${key.valueId}" href="#">${value.name}</a></li>`);
                })
            },
            removeKException: function(refinementId){
                refinementId = parseInt(refinementId);
                state.clustering.kExceptions.erase(refinementId);
                kvClustering.drawKExceptions();
                kvClustering.fetchKRefinements(kvClustering.addRefinementToQuery($("#search_text").val(), true));
            },
            removeKvException: function(refinementString){
                const keyId = parseInt(refinementString.split(":")[0]);
                const valueId = parseInt(refinementString.split(":")[1]);
                const refinementObject = {keyId: keyId, valueId: valueId};
                state.clustering.kvExceptions.erase(JSON.stringify(refinementObject));
                kvClustering.drawKvExceptions();
                kvClustering.fetchKvRefinements(kvClustering.addRefinementToQuery($("#search_text").val(), true));
            },

            removeRefinement: function(refinement){
                console.log(refinement);
                for(var i = state.clustering.activeRefinements.length - 1; i >= 0; i--) {
                    if(state.clustering.activeRefinements[i] === refinement) {
                        state.clustering.activeRefinements.splice(i, 1);
                    }
                }
                console.log(state.clustering.activeRefinements);
                kvClustering.drawActiveRefinements();
            },

            drawExceptions: function(){
                const exceptionList = $("#exception-list");
                exceptionList.empty();
                state.clustering.kExceptions.forEach(function(exceptionId){
                    exceptionList.append(`<li class="active-exception" id="${exceptionId}"><a>${state.clustering.refinements.at(parseInt(exceptionId))}</a></li>`);
                });
            },

            drawKDebugInfo(){
                const kDebugInfo = $('#kDebugInfo');
                kDebugInfo.empty();
                kDebugInfo.append(kvClustering.getDebugInfoString(state.clustering.kDebugInfo));
            },

            drawPDebugInfo(){
                const pDebugInfo = $('#pDebugInfo');
                pDebugInfo.empty();
                pDebugInfo.append(kvClustering.getDebugInfoString(state.clustering.pDebugInfo));
            },

            drawKvDebugInfo(){
                const kvDebugInfo = $('#kvDebugInfo');
                kvDebugInfo.empty();
                kvDebugInfo.append(kvClustering.getDebugInfoString(state.clustering.kvDebugInfo));
            },
            getDebugInfoString(debugInfo){
              debugHtml = `<h4>Debug Info</h4>
                            <ul style="list-style-type: none; margin-left: -40px">
                                <li>Number of Items: ${debugInfo.itemCount}</li>
                                <li>Number of Parents: ${debugInfo.parentCount}</li>
                                <li>Number of Pairs: ${debugInfo.pairCount}</li>
                                <li>Time to generate map: ${debugInfo.timeToGenerateMap} ms</li>
                                <li>Time to sort: ${debugInfo.timeToSort} ms</li>
                                <li>Time to find first parents: ${debugInfo.timeToFindFirstParents} ms</li>
                                <li>Time to find other parents: ${debugInfo.timeToFindOtherParents} ms</li>
                                <li>Total time: ${debugInfo.totalTime} ms</li>
                           </ul>`;
              return state.clustering.debug ? debugHtml : "";
            },


            fillTable: function(cqr, force) {

                let clusteringType = $('#refinement_type option:selected').val();

                let exceptionString = "&exceptions=" + JSON.stringify(state.clustering.kExceptions);

                let queryRequest = "/oscar/kvclustering/get?q=" + cqr + "&rf=admin_level&queryId=" + state.queries.activeCqrId
                    + "&type=" + clusteringType + "&maxRefinements=10" + exceptionString;

                $.get(queryRequest, function (data) {
                    if(state.queries.activeCqrId!==data.queryId && !force)
                        return;

                    const kvClusteringList = $("#kvclustering-list");
                    kvClusteringList.empty();
                    let liAdded = false;
                    data.clustering.forEach(function(parent){

                        if(clusteringType === 'kv'){
                            state.clustering.refinements.insert({ key : parent.keyId, value : parent.valueId }, parent.name);
                        } else {
                          state.clustering.refinements.insert( parent.id, parent.name,);
                        }

                        liAdded = true;
                        kvClusteringList.append(`<li style="margin-top: 5px"><a class="refinement" id="${parent.name}" href="#">${parent.name}(${parent.itemCount})</a>
                                                <a class="refinement-exception" id=${parent.id} href="#">x</a></li>`);
                    });
                    console.log(state.clustering.refinements);
                    if(!liAdded){
                        kvClusteringList.append(`<li style="margin-top: 5px">no refinements for this query</li>`);
                    }
                    kvClusteringList.removeClass("hidden");
                });

                // if(!$('#clusterModi input').is(":checked")){
                //     $.get("/oscar/kvclustering/get?q=" + cqr + "&queryId=" + state.queries.activeCqrId + "&type=kv&maxRefinements=10", function (data) {
                //         if(state.queries.activeCqrId!==data.queryId)
                //             return;
                //         const kvClusteringList = $("#kvclustering-list");
                //         kvClusteringList.empty();
                //         let liAdded = false;
                //         data.keyValueClustering.forEach(function(key){
                //             if(key.clValues.length > 1){
                //                 kvClusteringList.append(`<li style="margin-top: 5px"><b>refine by ${key.name}(${key.count})</b></li>`);
                //                 key.clValues.forEach(function(value){
                //                     kvClusteringList.append(`<li class="refinement" id="@${key.name}:${value.name} ${cqr}"><a href="#">${value.name}(${value.count})</a></li>`);
                //                 });
                //                 liAdded = true;
                //             }
                //         });
                //         if(!liAdded){
                //             kvClusteringList.append(`<li style="margin-top: 5px">no refinements for this query</li>`);
                //         }
                //         kvClusteringList.removeClass("hidden");
                //     });
                // } else {
                //     $.get("/oscar/kvclustering/get?q=" + cqr + "&rf=admin_level&queryId=" + state.queries.activeCqrId + "&type=p&maxRefinements=10", function (data) {
                //         if(state.queries.activeCqrId!==data.queryId)
                //             return;
                //         console.log(data);
                //         const kvClusteringList = $("#kvclustering-list");
                //         kvClusteringList.empty();
                //         let liAdded = false;
                //         data.parentClustering.forEach(function(parent){
                //             liAdded = true;
                //             kvClusteringList.append(`<li class="refinement" id="&quot;${parent.parentName}&quot; ${cqr}"  "style="margin-top: 5px"><a href="#">${parent.parentName}(${parent.itemCount})</a></li>`);
                //         });
                //         if(!liAdded){
                //             kvClusteringList.append(`<li style="margin-top: 5px">no refinements for this query</li>`);
                //         }
                //         kvClusteringList.removeClass("hidden");
                //     });
                // }
            }

        };
        return kvClustering;
    });