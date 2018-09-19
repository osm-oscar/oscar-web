define(["require", "state", "jquery", "search", "tools"],
    function (require, state, $, search, tools) {
        var kvClustering = {

            drawKRefinements: function(){
                const kClusteringList = $("#kClustering-list");
                kClusteringList.empty();
                console.log(state.clustering.kRefinements);
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
                    kvClusteringList.append(
                        `<li style="margin-top: 5px"><a class="refinement" id=@${value.name} href="#">${value.name}(${value.itemCount})</a>
                                                <a class="kvRefinement-exception" id="${parent.keyId}:${parent.valueId}" href="#">x</a></li>`) ;
                });
            },

            fetchKRefinements: function(query, force){
                let exceptionString = "&exceptions=[";
                state.clustering.kExceptions.each(function (key, value) {
                    exceptionString += key + ",";
                });
                exceptionString += "]";
                console.log(exceptionString);
                let queryRequest = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level&queryId=" + state.queries.activeCqrId
                    + "&type=k&maxRefinements=10"+exceptionString;
                $.get(queryRequest, function (data) {
                    state.clustering.kRefinements = tools.SimpleHash();
                    if(state.queries.activeCqrId!==data.queryId && !force)
                        return;

                    data.clustering.forEach(function(key){
                        state.clustering.kRefinements.insert( key.id, {name: key.name, itemCount: key.itemCount});
                    });
                    kvClustering.drawKRefinements();
                });
            },

            fetchPRefinements: function(query, force){

                let queryRequest = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level&queryId=" + state.queries.activeCqrId
                    + "&type=p&maxRefinements=10";
                $.get(queryRequest, function (data) {
                    state.clustering.pRefinements = tools.SimpleHash();
                    if(state.queries.activeCqrId!==data.queryId && !force)
                        return;

                    data.clustering.forEach(function(parent){
                        state.clustering.pRefinements.insert( parent.id, {name: parent.name, itemCount: parent.itemCount});
                    });
                    kvClustering.drawPRefinements();
                });
            },

            fetchKvRefinements: function(query, force){
                let exceptionString = "&exceptions=" + JSON.stringify(state.clustering.kvExceptions);
                let queryRequest = "/oscar/kvclustering/get?q=" + kvClustering.addRefinementToQuery(query) + "&rf=admin_level&queryId=" + state.queries.activeCqrId
                    + "&type=kv&maxRefinements=10" + exceptionString;
                $.get(queryRequest, function (data) {
                    state.clustering.kvRefinements = tools.SimpleHash();
                    if(state.queries.activeCqrId!==data.queryId && !force)
                        return;

                    data.clustering.forEach(function(keyValueData){
                        state.clustering.kvRefinements.insert( {keyId: keyValueData.keyId, valueId: keyValueData.valueId}, {name: keyValueData.name, itemCount: keyValueData.itemCount});
                    });
                    kvClustering.drawKvRefinements();
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
            drawKExceptions: function(){
                    const kExceptionList = $('#kException-list');
                    kExceptionList.empty();
                state.clustering.kExceptions.each(function (key, value) {
                    kExceptionList.append(`<li><a class="active-exception" id="${key}" href="#">${value.name}</a></li>`);
                })
            },
            removeKException: function(refinementId){
                refinementId = parseInt(refinementId);
                state.clustering.kExceptions.erase(refinementId);
                console.log(state.clustering.kExceptions);
                kvClustering.drawKExceptions();
                kvClustering.fetchKRefinements(kvClustering.addRefinementToQuery($("#search_text").val(), true));
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