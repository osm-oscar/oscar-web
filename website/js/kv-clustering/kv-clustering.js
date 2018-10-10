define(["require", "state", "jquery", "search", "tools"],
    function (require, state, $, search, tools) {
        var kvClustering = {
            numberOfAdditionalRefinements : 5,
            closeClustering: function(queryWithoutRefinements){
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
                    activeIncludingRefinements: state.clustering.activeIncludingRefinements,
                    activeExcludingRefinements: state.clustering.activeExcludingRefinements,
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
                    kvRefinementCount: 10,
                    kRefinementCount: 10,
                    pRefinementCount: 10,
                    pHasMore: false,
                    kHasMore: false,
                    kvHasMore: false,
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
                        `<li class="list-group-item d-flex justify-content-between align-items-center">
                            <span class="inner-refinement">
                                ${value.name}
                                <i class="fa fa-lg fa-plus-circle including-refinement refinement-button" id=@${value.name} href="#"></i>
                                <i class="fa fa-lg fa-minus-circle excluding-refinement refinement-button" id=@${value.name} href="#"></i>
                                <i class="fa fa-lg fa-times-circle kRefinement-exception refinement-button" id=${key} href="#"></i>
                            </span>
                            <span class = "badge badge-primary badge-pill">${value.itemCount}</span>
                         </li>`) ;
                });
                kvClustering.showMore(state.clustering.kHasMore, 'k');
                if(!added)
                    kClusteringList.append(`No refinements for this query.`);
            },
            drawPRefinements: function(){
                const pClusteringList = $("#pClustering-list");
                pClusteringList.empty();
                state.clustering.pRefinements.each(function(key, value){
                    pClusteringList.append(
                        `<li  class="list-group-item d-flex justify-content-between align-items-center">
                            <span class="inner-refinement">
                            ${value.name}
                            <i class="fa fa-lg fa-plus-circle including-refinement refinement-button" id="&quot;${value.name}&quot;" href="#"></i>
                            <i class="fa fa-lg fa-minus-circle excluding-refinement refinement-button" id="&quot;${value.name}&quot;" href="#"></i>
                            </span>
                            <span class = "badge badge-primary badge-pill">${value.itemCount}</span>
                         </li>`) ;
                });
                kvClustering.showMore(state.clustering.pHasMore, 'p');
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
                            <span class="inner-refinement">
                                ${value.name}
                                <i class="fa fa-lg fa-plus-circle including-refinement refinement-button" id=@${value.name} href="#"></i>
                                <i class="fa fa-lg fa-minus-circle excluding-refinement refinement-button" id=@${value.name} href="#"></i>
                                <i class="fa fa-lg fa-times-circle kvRefinement-exception refinement-button" id="${key.keyId}:${key.valueId}" href="#"></i>
                            </span>
                            <span class = "badge badge-primary badge-pill">${value.itemCount}</span>
                         </li>`) ;
                });
                kvClustering.showMore(state.clustering.kvHasMore, 'kv');
                if(state.clustering.kvRefinements.size() === 0)
                    kvClusteringList.append(`No refinements for this query.`);
            },
            drawLoadingPlaceholders: function(count, minWidth, maxWidth, mode){
                const refinementList = $('#'+mode+'Clustering-list');
                refinementList.empty();
                const  refinementLoading = $('.'+mode+'Refinement-loading');
                refinementLoading.removeClass('hidden');
                refinementLoading.empty();
                for(let i = 0; i < count; i++){
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
                    + "&type=k&maxRefinements=" + state.clustering.kRefinementCount + exceptionString+ '&debug=' + state.clustering.debug;

                let queryRequestWithId = queryRequestWithoutId + "&queryId=" + state.clustering.kQueryId;

                if(queryRequestWithoutId===state.clustering.lastKQuery)
                    return;

                state.clustering.kRefinements = tools.SimpleHash();
                state.clustering.kDebugInfo = {};
                kvClustering.drawKDebugInfo();
                kvClustering.drawKRefinements();
                kvClustering.drawLoadingPlaceholders(state.clustering.kRefinementCount,75, 125, 'k');
                state.clustering.lastKQuery = queryRequestWithoutId;


                $.ajax({
                    type: "GET",
                    url: "/oscar/kvclustering/get",
                    data: {'q' : kvClustering.addRefinementToQuery(query),
                           'rf' : 'admin_level',
                        'type': 'k',
                        'maxRefinements' : state.clustering.kRefinementCount,
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
                        state.clustering.kHasMore = data.hasMore;
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
                    + "&type=p&maxRefinements=" + state.clustering.pRefinementCount + '&debug=' + state.clustering.debug;
                if(state.clustering.lastPQuery === queryRequestWithoutId)
                    return;
                state.clustering.pQueryId++;
                let queryRequestWithId = queryRequestWithoutId +"&queryId=" + state.clustering.pQueryId;
                state.clustering.pRefinements = tools.SimpleHash();
                kvClustering.drawPRefinements();
                state.clustering.pDebugInfo = {};
                kvClustering.drawPDebugInfo();
                kvClustering.drawLoadingPlaceholders(state.clustering.pRefinementCount,100, 150, 'p');
                state.clustering.lastPQuery = queryRequestWithoutId;
                $.get(queryRequestWithId, function (data) {

                });
                $.ajax({
                    type: "GET",
                    url: "/oscar/kvclustering/get",
                    data: {'q' : kvClustering.addRefinementToQuery(query),
                        'rf' : 'admin_level',
                        'type': 'p',
                        'maxRefinements' : state.clustering.pRefinementCount,
                        'debug' : state.clustering.debug,
                        'queryId' : state.clustering.pQueryId
                    },
                    dataType: 'JSON',
                    mimeType: 'application/JSON',
                    success: function (data) {
                        state.clustering.pRefinements = tools.SimpleHash();
                        if(state.clustering.pQueryId!==data.queryId && !force)
                            return;

                        state.clustering.pHasMore = data.hasMore;

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
                    + "&type=kv&maxRefinements=" + state.clustering.kvRefinementCount + exceptionString + '&debug=' + state.clustering.debug;
                if(queryRequestWithoutId===state.clustering.lastKvQuery)
                    return;
                state.clustering.kvQueryId++;
                let queryRequestWithId = queryRequestWithoutId +  "&queryId=" + state.clustering.kvQueryId;
                state.clustering.kvDebugInfo = {};
                state.clustering.kvRefinements = tools.SimpleHash();
                state.clustering.kvDebugInfo = {};
                kvClustering.drawKvDebugInfo();
                kvClustering.drawKvRefinements();
                kvClustering.drawLoadingPlaceholders(state.clustering.kvRefinementCount, 100, 150, 'kv');
                state.clustering.lastKvQuery = queryRequestWithoutId;
                $.ajax({
                    type: "GET",
                    url: "/oscar/kvclustering/get",
                    data: {'q' : kvClustering.addRefinementToQuery(query),
                        'rf' : 'admin_level',
                        'type': 'kv',
                        'maxRefinements' : state.clustering.kvRefinementCount,
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

                        state.clustering.kvHasMore = data.hasMore;

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
                let includingRefinementString = "";
                state.clustering.activeIncludingRefinements.forEach(function (refinementName) {
                    includingRefinementString += unescape(refinementName) + " ";
                });
                let excludingRefinementString = "";
                state.clustering.activeExcludingRefinements.forEach(function (refinementName) {
                    excludingRefinementString += " - " + unescape(refinementName) + " ";
                });
                return includingRefinementString + query + excludingRefinementString;
            },
            addIncludingRefinement: function(refinementName){
                state.clustering.activeIncludingRefinements.push(escape(refinementName));
                kvClustering.drawActiveRefinements();
            },
            addExcludingRefinement: function(refinementName){
                state.clustering.activeExcludingRefinements.push(escape(refinementName));
                kvClustering.drawActiveRefinements();
            },
            drawActiveRefinements: function() {
                const refinements = $('#refinements');
                refinements.empty();
                state.clustering.activeIncludingRefinements.forEach(function (refinementName){
                  const escapedName = refinementName;
                  refinementName = unescape(refinementName);
                  refinements.append(`<span class="badge" style="background-color: green""><span class="active-refinement" style="cursor: pointer" id=${escapedName} >x</span> ${refinementName}</span>`);
                });
                state.clustering.activeExcludingRefinements.forEach(function (refinementName){
                  const escapedName = refinementName;
                  refinementName = unescape(refinementName);
                  refinements.append(`<span class="badge" style="background-color: red"><span class="active-refinement" style="cursor: pointer" id=${escapedName} >x</span> ${refinementName}</span>`);
                });
            },
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
                for(let i = state.clustering.activeIncludingRefinements.length - 1; i >= 0; i--) {
                    if(state.clustering.activeIncludingRefinements[i] === refinement) {
                        state.clustering.activeIncludingRefinements.splice(i, 1);
                    }
                }
                for(let i = state.clustering.activeExcludingRefinements.length - 1; i >= 0; i--) {
                    if(state.clustering.activeExcludingRefinements[i] === refinement) {
                        state.clustering.activeExcludingRefinements.splice(i, 1);
                    }
                }
                kvClustering.drawActiveRefinements();
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
            showMore: function(visible, mode){
                if(visible){
                    $('#' + mode + 'ShowMore').show();
                } else {
                    $('#' + mode + 'ShowMore').hide();
                }
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
        };
        return kvClustering;
    });