# Demo

The master branch version is runnig at [www.oscar-web.de](http://www.oscar-web.de).
A version supporting faceted search based on the faceted-clustering branch is available at [kvclustering.oscar-web.de](http://kvclustering.oscar-web.de).

# oscar-web

oscar-web is a web-interface for simple interaction with the OpenStreetMap search engine [oscar](https://github.com/dbahrdt/oscar). The goal is to provide an easy to use interface and allowing
to present every search result, independent of size, on the map using clustering.

To search for specific institutions like restaurants, parks or hotels the corresponding [OSM-Tag](http://wiki.openstreetmap.org/wiki/Tags) needs to be added to the search query, because currently [oscar](https://github.com/dbahrdt/oscar)
isn't capable of mapping something like "pizza" to "cuisine=pizza". To prevent that a user needs to know such tags, frequently used ones are integrated in a search menu so that they can be easily added to the query. If a corresponding tag is not in the menu
an additional search field, that queries the [taginfo](http://taginfo.openstreetmap.org/) database, can be used.

# Running your own version

## Prerequisites

- CGAL
- ragel
- CppCMS
- (cgdb)

## Clone

`git clone --recursive https://github.com/dbahrdt/oscar-web`

## Building

### Debug build
```
cd oscar-web
mkdir build && cd build
cmake ../
make
```

### Release build
```
cd oscar-web
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Release  ../
```

### Ultra build
```
cd oscar-web
mkdir build && cd build
CMAKE_GCC_VERSION_FOR_LTO=8 cmake ../ -DCMAKE_BUILD_TYPE=ultra
```

Replace 8 with an appropriate version V such that `gcc-ar-V` and `gcc-nm-V` are available.

## Configuration

### Configure your webserver
Sample configuration files are located in the services folder

### Configuring the back end

Read the configuration hints:
```
cd services
cat readme
```

Create a symlink to the binary you just compiled in the builds folder:
```
ln -s ../build/ builds/production
```

Edit the configuration. See ${PROJECT_ROOT}/server/oscar-web-config.js for possible options:
```
vim cfg/oscar-web-config.js
```

Run the server component. By default this is run using cgdb to catch crashes in order to debug them. Though we haven't seen any for a longer period of time.
```
./run-production.sh
```
