define(["require", "state", "jquery"],
    function (require, state, $) {
        var kvClustering = {
            fillTable: function() {
                const currentQueue = window.location.search.replace("?q=", "");
                $("#kvclustering-list").empty();
                $.get("/oscar/kvclustering/get" + window.location.search, function (data) {
                    data.kvclustering.forEach(function(key){
                        if(key.clValues.length > 1){
                            const kvClusteringList = $("#kvclustering-list");
                            kvClusteringList.append(`<li style="margin-top: 5px"><b>refine by ${key.name}(${key.count})</b></li>`);
                            key.clValues.forEach(function(value){
                                kvClusteringList.append(`<li><a href="/?q=${"@" + key.name + ":" + value.name + " " + currentQueue}">${value.name}(${value.count})</a></li>`);
                            });
                        }
                    });
                })
            }
        };
        return kvClustering;
    });