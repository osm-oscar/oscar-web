{
		addItemMarkerToMap: function(marker, itemId, shapeSrcType) {
            var itemDetailsId = '#' + shapeSrcType + 'Details' + itemId;
            var itemPanelRootId = '#' + shapeSrcType + 'PanelRoot' + itemId;
            if (config.functionality.shapes.highlightListItemOnClick[shapeSrcType]) {
                marker.on('click', function () {
					map.highlightShape(itemId, "items");

                    if ($('#show_flickr').is(':checked')) {
                        var geopos;

                        if (this instanceof L.MultiPolygon) {
                            geopos = this.getLatLngs()[0][0];
                        } else if (this instanceof L.Polygon) {
                            geopos = this.getLatLngs()[0];
                        } else if (this instanceof L.Polyline) {
                            geopos = this.getLatLngs()[0];
                        } else {
                            geopos = this.getLatLng();
                        }
                        flickr.getImagesForLocation($.trim(state.DAG.at(itemId).name), geopos);
                    }
                    
                    if (!$('#item_relatives').hasClass('active')) {
						state.sidebar.open("search");
					}
                    // open a tab, that contains the element
                    var parentId = state.DAG.at(itemId).parents[0].id;
                    var index = $("#tabs a[href='#tab-" + parentId + "']").parent().index();

                    $("#items_parent").tabs("option", "active", index);

                    $('#' + shapeSrcType + "List").find('.panel-collapse').each(
                        function () {
                            if ($(this).hasClass('in')) {
                                $(this).collapse('hide');
                            }
                        }
                    );
                    $(itemDetailsId).collapse('show');
					state.items.activeItem = itemId;
                    //var container = $('#'+ shapeSrcType +'_parent');
                    var container = $(".sidebar-content");
                    var itemPanelRootDiv = $(itemPanelRootId);
                    if (itemPanelRootDiv === undefined) {
                        console.log("addItemMarkerToMap: undefined PanelRoot", marker, itemId, shapeSrcType, state);
                    }
                    else {
                        var scrollPos = itemPanelRootDiv.offset().top - container.offset().top + container.scrollTop();
                        container.animate({scrollTop: scrollPos});
                        //container.animate({scrollTop: itemPanelRootDiv.position().top + $("itemsList").position().top});
                    }
                    map.showItemRelatives();
                });
			}
		},
		
        addShapeToMap: function (leafletItem, itemId, shapeSrcType) {
            var itemDetailsId = '#' + shapeSrcType + 'Details' + itemId;
            var itemPanelRootId = '#' + shapeSrcType + 'PanelRoot' + itemId;
			state.map.addLayer(leafletItem);
			state[shapeSrcType].shapes.drawn.insert(itemId, leafletItem);
        },
		clearHighlightedShapes: function(shapeSrcType) {
			for(var i in state[shapeSrcType].shapes.highlighted.values()) {
				if (!state[shapeSrcType].shapes.regular.count(i)) {//if it's not regularly drawn, remove it
					state.map.removeLayer(state[shapeSrcType].shapes.drawn.at(i));
					state[shapeSrcType].shapes.drawn.erase(i);
				}
				else {
					state[shapeSrcType].shapes.drawn.at(i).setStyle(myConfig.styles.shapes[shapeSrcType]['normal']);
				}
			}
			state[shapeSrcType].shapes.highlighted.clear();
		},
		highlightShape: function(itemId, shapeSrcType) {
			if (state[shapeSrcType].shapes.highlighted.count(itemId)) {//already highlighted
				return;
			} 
			if (state[shapeSrcType].shapes.drawn.count(itemId)) { //this already on the map, change the style
				var lfi = state[shapeSrcType].shapes.drawn.at(itemId);
				map.clearHighlightedShapes(shapeSrcType);
				state[shapeSrcType].shapes.highlighted.set(itemId, lfi);
				lfi.setStyle(config.styles.shapes[shapeSrcType]['highlight']);
				state.map.fitBounds(lfi.getBounds());
			}
			else {
				state[shapeSrcType].shapes.promised.clear();
				state[shapeSrcType].shapes.promised.set(itemId, itemId);
				oscar.getShape(itemId,
								function(shape) {
									if (!state[shapeSrcType].shapes.promised.count(itemId) || state[shapeSrcType].shapes.drawn.count(itemId)) {
										return;
									}
									map.clearHighlightedShapes(shapeSrcType);
									var leafLetItem = oscar.leafletItemFromShape(shape);
									leafLetItem.setStyle(config.styles.shapes[shapeSrcType]['highlight']);
									state[shapeSrcType].shapes.highlighted.set(itemId, itemId);
									map.addShapeToMap(leafLetItem, itemId, shapeSrcType);
								},
								tools.defErrorCB
				);
				oscar.getItem(itemId,
								function(item) {
									state.map.fitBounds(item.bbox());
								}, tools.defErrorCB);
			}
		},
        visualizeResultListItems: function () {
            state.items.shapes.promised.clear();
            var itemsToDraw = [];
            for (var i in state.items.listview.drawn.values()) {
                if (!state.items.shapes.cache.count(i)) {
                    state.items.shapes.promised.set(i, state.items.listview.drawn.at(i));
                    itemsToDraw.push(i);
                }
            }

            spinner.startLoadingSpinner();
            oscar.getShapes(itemsToDraw, function (shapes) {
                spinner.endLoadingSpinner();

                var marker;
                for (var i in itemsToDraw) {
                    var itemId = itemsToDraw[i];
                    if (!state.items.shapes.promised.count(itemId)) {
                        continue;
                    }
                    if (shapes[itemId] === undefined || !state.items.listview.drawn.count(itemId) ||
                        state.items.shapes.cache.count(itemId))
					{
                        state.items.shapes.promised.erase(itemId);
                        continue;
                    }

                    state.items.shapes.promised.erase(itemId);
                    var itemShape = oscar.leafletItemFromShape(shapes[itemId]);
                    itemShape.setStyle(config.styles.shapes.items.normal);

                    if (itemShape instanceof L.MultiPolygon) {
                        marker = L.marker(itemShape.getLatLngs()[0][0]);
                    } else if (itemShape instanceof L.Polygon) {
                        marker = L.marker(itemShape.getLatLngs()[0]);
                    } else if (itemShape instanceof L.Polyline) {
                        marker = L.marker(itemShape.getLatLngs()[0]);
                    } else {
                        marker = L.marker(itemShape.getLatLng());
                    }

                    state.markers.addLayer(marker);
                    state.items.shapes.cache.insert(itemId, itemShape);
                    state.DAG.at(itemId).marker = marker;
                    state.DAG.at(itemId).shape = itemShape;
                    map.addItemMarkerToMap(marker, itemId, "items");
                }
            }, tools.defErrorCB);
        },

        getItemIds: function (regionId, itemIds) {

            for (var i in itemIds) {
                var itemId = itemIds[i];
                state.items.listview.promised.insert(itemId, itemId);
            }

            oscar.getItems(itemIds,
                function (items) {
                    var node;
                    state.items.clusters.drawn.erase(regionId);

                    // manage items -> kill old items if there are too many of them and show clusters again
                    if (state.items.listview.drawn.size() + items.length > config.maxBufferedItems) {
                        for (var i in state.items.listview.drawn.values()) {
                            node = state.DAG.at(i);
                            for (var parent in node.parents) {
                                if (!state.items.clusters.drawn.count(node.parents[parent].id)) {
                                    state.markers.addLayer(node.parents[parent].marker);
                                    state.items.clusters.drawn.insert(node.parents[parent].id, node.parents[parent].marker);
                                }
                            }
                            if (node.marker) {
                                state.markers.removeLayer(node.marker);
                            }
                            node.kill();
                            delete node;
                        }
                        $('#itemsList').empty();
                        $('#tabs').empty();
                        state.items.listview.drawn.clear();
                        state.items.shapes.cache.clear();
						state.items.shapes.markers.clear();
                    }

                    var tabsInitialized = $('#items_parent').data("ui-tabs");
                    var tab = "<li><a href='#tab-" + regionId + "'>" + state.DAG.at(regionId).name + "</a><span class='badge'>" + items.length + "</span></li>";
                    if (!$("a[href='#tab-" + regionId + "']").length) {
                        $('#tabs').append(tab);
                    }

                    if (!tabsInitialized) {
                        $('#items_parent').tabs();
                    }

                    var regionDiv = "<div id='tab-" + regionId + "'></div>";
                    if (!$("#tab-" + regionId).length) {
                        $('#itemsList').append(regionDiv);
                    }
                    var parentElement = $('#tab-' + regionId);
                    for (var i in items) {
                        var item = items[i];
                        var itemId = item.id();
                        if (state.items.listview.promised.count(itemId)) {
                            if (!state.DAG.count(itemId)) {
                                state.DAG.insert(itemId, state.DAG.at(regionId).addChild(itemId));
                            } else {
                                //TODO: check whether regionId already contains this itemId as child
                                state.DAG.at(regionId).children.push(state.DAG.at(itemId));
                                state.DAG.at(itemId).parents.push(state.DAG.at(regionId));
                            }
                            state.DAG.at(itemId).name = item.name();
                            map.appendToItemsList(item, parentElement);
                            state.items.listview.promised.erase(itemId);
                        }
                    }
                    map.refreshTabs();
                    map.visualizeResultListItems();

                    if (state.visualizationActive) {
                        tree.refresh(regionId);
                    }

                },
                tools.defErrorCB
            );
        },

        loadSubhierarchy: function (rid, finish) {
            state.cqr.regionChildrenInfo(rid, function (regionChildrenInfo) {
                var children = [];
                var regionChildrenApxItemsMap = {};

                for (var i in regionChildrenInfo) {
                    var ci = regionChildrenInfo[i];
                    regionChildrenApxItemsMap[ci['id']] = ci['apxitems'];
                    children.push(ci['id']);
                }

                oscar.getItems(children, function (items) {
                        var itemId, item, node, parentNode, marker;
                        parentNode = state.DAG.at(rid);

                        for (var i in items) {
                            item = items[i];
                            itemId = item.id();
                            if (!state.DAG.count(itemId)) {
                                node = parentNode.addChild(itemId);
                                marker = L.marker(item.centerPoint());
                                node.count = marker.count = regionChildrenApxItemsMap[itemId];
                                node.bbox = marker.bbox = item.bbox();
                                node.name = marker.name = item.name();
                                marker.rid = item.id();
                                map.decorateMarker(marker);
                                node.marker = marker;
                                state.DAG.insert(itemId, node);
                                map.addClusterMarker(state.DAG.at(itemId));
                            }
                        }

                        if ($("#onePath").is(':checked')) {
                            tree.onePath(parentNode);
                        } else {
                            tree.refresh(rid);
                        }

                        finish();
                    }, function () {
                    }
                );
            }, function(){});
        },
}