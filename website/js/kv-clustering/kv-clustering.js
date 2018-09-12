define(["require", "state", "jquery", "search"],
    function (require, state, $, search) {
        var kvClustering = {

            addRefinementToQuery: function(query) {
                let refinementString = "";
                $('.active-refinement').each(function (i, obj) {
                    refinementString += this.innerHTML + " ";
                });
                return refinementString + query;
            },

            addRefinement: function(refinement){
                $('#refinements').append(`<span class="badge badge-primary active-refinement">${refinement}</span>`);
            },

            removeRefinement: function(refinement){
                $(refinement).remove();
            },

            fillTable: function(cqr) {

                let clusteringType = $('input[name=clustering]:checked', '#clusterModi').val();

                let queryRequest = "/oscar/kvclustering/get?q=" + cqr + "&rf=admin_level&queryId=" + state.queries.activeCqrId
                    + "&type=" + clusteringType + "&maxRefinements=10";

                $.get(queryRequest, function (data) {
                    if(state.queries.activeCqrId!==data.queryId)
                        return;
                    console.log(data);
                    const kvClusteringList = $("#kvclustering-list");
                    kvClusteringList.empty();
                    let liAdded = false;
                    data.clustering.forEach(function(parent){
                        liAdded = true;
                        kvClusteringList.append(`<li class="refinement" id="&quot;${parent.name}&quot;"  "style="margin-top: 5px"><a href="#">${parent.name}(${parent.itemCount})</a></li>`);
                    });
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