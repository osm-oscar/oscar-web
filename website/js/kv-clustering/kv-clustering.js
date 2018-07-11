define(["require", "state", "jquery", "search"],
    function (require, state, $, search) {
        var kvClustering = {
            fillTable: function(cqr) {


                $.get("/oscar/kvclustering/get?q=" + cqr + "&queryId=" + state.queries.activeCqrId, function (data) {
                    if(state.queries.activeCqrId!==data.queryId)
                        return;
                    $("#kvclustering-list").empty();
                    data.kvclustering.forEach(function(key){
                        if(key.clValues.length > 1){
                            const kvClusteringList = $("#kvclustering-list");
                            kvClusteringList.append(`<li style="margin-top: 5px"><b>refine by ${key.name}(${key.count})</b></li>`);
                            key.clValues.forEach(function(value){
                                kvClusteringList.append(`<li id="@${key.name}:${value.name} ${cqr}"><a href="">${value.name}(${value.count})</a></li>`);
                            });
                        }
                    });
                    $("#kvclustering-list").removeClass("hidden");
                })
            }
        };
        return kvClustering;
    });