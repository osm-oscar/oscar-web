define(["require", "state", "jquery", "search", "tools"],
    function (require, state, $, search, tools) {
        var kvClustering = {

            closeClustering: function(){
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
                    kExceptions: tools.SimpleHash() // keyId -> {name: String, itemCount: int}
                };
                kvClustering.drawKRefinements();
                kvClustering.drawPRefinements();
                kvClustering.drawKvRefinements();
                kvClustering.drawKExceptions();
                kvClustering.drawKvExceptions();
                kvClustering.drawActiveRefinements();
            },

            drawKRefinements: function(){
                const kClusteringList = $("#kClustering-list");
                kClusteringList.empty();
                state.clustering.kRefinements.each(function(key, value){
                    console.log(key);
                    kClusteringList.append(
                        `<li style="margin-top: 5px"><a class="refinement" id=@${value.name} href="#">${value.name}(${value.itemCount})</a>
                                                <a class="kRefinement-exception" id=${key} href="#">x</a></li>`) ;
                });
            },
            drawPRefinements: function(){
                const pClusteringList = $("#pClustering-list");
                pClusteringList.empty();
                state.clustering.pRefinements.each(function(key, value){
                    pClusteringList.append(
                        `<li style="margin-top: 5px"><a class="refinement" id="&quot;${value.name}&quot;" href="#">${value.name}(${value.itemCount})</a></li>`) ;
                });
            },
            drawKvRefinements: function(){
                const kvClusteringList = $("#kvClustering-list");
                kvClusteringList.empty();
                state.clustering.kvRefinements.each(function(key, value){
                    key = JSON.parse(key);
                    kvClusteringList.append(
                        `<li style="margin-top: 5px"><a class="refinement" id=@${value.name} href="#">${value.name}(${value.itemCount})</a>
                                                <a class="kvRefinement-exception" id="${key.keyId}:${key.valueId}" href="#">x</a></li>`) ;
                });
            },

            drawLoadingPlaceholders: function(count, minWidth, maxWidth){
                const  refinementLoading = $('.refinement-loading');
                refinementLoading.removeClass('hidden');
                refinementLoading.empty();
                for(let i = 0; i< count; i++){
                    refinementLoading.append(`<div class="refinement-loading--refinement" style="width: ${minWidth+Math.floor(Math.random() * maxWidth)}px"></div>`);
                }
            },

            fetchKRefinements: function(query, force){
                state.clustering.kRefinements = tools.SimpleHash();
                kvClustering.drawKRefinements();
                kvClustering.drawLoadingPlaceholders(11, 75, 125);
                let exceptionString = "&exceptions=[";
                state.clustering.kExceptions.each(function (key, value) {
                    exceptionString += key + ",";
                });
                exceptionString += "]";
                state.clustering.kQueryId++;
                let queryRequest = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level&queryId=" + state.clustering.kQueryId
                    + "&type=k&maxRefinements=10" + exceptionString;
                $.get(queryRequest, function (data) {

                    if(state.clustering.kQueryId!==data.queryId && !force)
                        return;

                    data.clustering.forEach(function(key){
                        state.clustering.kRefinements.insert( key.id, {name: key.name, itemCount: key.itemCount});
                    });
                    $('.refinement-loading').empty();
                    kvClustering.drawKRefinements();
                });
            },

            fetchPRefinements: function(query, force){
                state.clustering.pRefinements = tools.SimpleHash();
                kvClustering.drawPRefinements();
                kvClustering.drawLoadingPlaceholders(11, 100, 150);
                state.clustering.pQueryId++;
                let queryRequest = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level&queryId=" + state.clustering.pQueryId
                    + "&type=p&maxRefinements=10";
                $.get(queryRequest, function (data) {
                    state.clustering.pRefinements = tools.SimpleHash();
                    if(state.clustering.pQueryId!==data.queryId && !force)
                        return;

                    data.clustering.forEach(function(parent){
                        state.clustering.pRefinements.insert( parent.id, {name: parent.name, itemCount: parent.itemCount});
                    });
                    $('.refinement-loading').empty();
                    kvClustering.drawPRefinements();
                });
            },

            fetchKvRefinements: function(query, force){
                state.clustering.kvRefinements = tools.SimpleHash();
                kvClustering.drawKvRefinements();
                kvClustering.drawLoadingPlaceholders(11, 100, 150);
                let exceptionString = "&exceptions=[";
                state.clustering.kvExceptions.each(function (key, value) {
                    key = JSON.parse(key);
                    exceptionString += "["  + key.keyId + "," + key.valueId + "],";
                });
                exceptionString += "]";
                state.clustering.kvQueryId++;
                let queryRequest = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level&queryId=" + state.clustering.kvQueryId
                    + "&type=kv&maxRefinements=10" + exceptionString;
                $.get(queryRequest, function (data) {
                    state.clustering.kvRefinements = tools.SimpleHash();
                    if(state.clustering.kvQueryId!==data.queryId && !force)
                        return;

                    data.clustering.forEach(function(keyValueData){
                        state.clustering.kvRefinements.insert( JSON.stringify({keyId: keyValueData.keyId, valueId: keyValueData.valueId}), {name: keyValueData.name, itemCount: keyValueData.itemCount});
                    });
                    kvClustering.drawKvRefinements();
                    $('.refinement-loading').empty();
                });
            },

            addRefinementToQuery: function(query) {
                let refinementString = "";
                $('.active-refinement').each(function (i, obj) {
                    refinementString += this.innerHTML + " ";
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
                  refinements.append(`<span class="badge badge-primary active-refinement" id=${escapedName}>${refinementName}</span>`);
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