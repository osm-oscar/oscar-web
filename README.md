# oscar-web

oscar-web is a web-interface for simple interaction with the OpenStreetMap search engine [oscar](https://github.com/dbahrdt/oscar). The goal is to provide an easy to use interface and allowing
to present every search result, independent of size, on the map using clustering.

To search for specific institutions like restaurants, parks or hotels the corresponding [OSM-Tag](http://wiki.openstreetmap.org/wiki/Tags) needs to be added to the search query, because currently [oscar](https://github.com/dbahrdt/oscar)
isn't capable of mapping something like "pizza" to "cuisine=pizza". To prevent that a user needs to know such tags, frequently used ones are integrated in a search menu so that they can be easily added to the query. If a corresponding tag is not in the menu
an additional search field, that queries the [taginfo](http://taginfo.openstreetmap.org/) database, can be used.

## Functionalities

- search in the viewport or in the global OSM dataset
- search within user defined polygons or paths
- geographical clustering of search results
- visualization of the OSM hierarchy
- help system that supports the user defining advanced queries
- flickr integration to enhance search results

## Used libraries

- [dagre-d3](https://github.com/cpettitt/dagre-d3)
- [sidebar-v2](https://github.com/Turbo87/sidebar-v2)
- [leaflet](http://leafletjs.com/)
- [leaflet-markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- [mustache](https://github.com/janl/mustache.js/)
- [bootstrap-tokenfield](https://github.com/sliptree/bootstrap-tokenfield)
- [jQuery-switchButton](https://github.com/olance/jQuery-switchButton)
- [slimbox2](http://www.digitalia.be/software/slimbox2/)
- [require.js](http://requirejs.org/)
