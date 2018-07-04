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

- A lot! Take a look into website/vendor folder

## Builds

### Ultra builds
CMAKE_GCC_VERSION_FOR_LTO=6 cmake ../ -DCMAKE_BUILD_TYPE=ultra

Replace 6 with an appropriate version


