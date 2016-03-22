cmake_minimum_required(VERSION 2.8)
project(oscar-web)

set(CMAKE_MODULE_PATH
	${CMAKE_CURRENT_SOURCE_DIR}/cmake/
	${CMAKE_CURRENT_SOURCE_DIR}/vendor/liboscar/cmake/
	${CMAKE_CURRENT_SOURCE_DIR}/vendor/liboscar/vendor/sserialize/cmake/
)

find_package(CPPCMS REQUIRED)
find_package(LIBRT)

include_directories(
	${CMAKE_CURRENT_BINARY_DIR}
	${CMAKE_CURRENT_SOURCE_DIR}
	${CMAKE_CURRENT_SOURCE_DIR}/vendor/liboscar/include/
	${CMAKE_CURRENT_SOURCE_DIR}/vendor/liboscar/vendor/sserialize/include/
	${CMAKE_SOURCE_DIR}
)

set(OSCAR_WEB_SOURCES_CPP
	server/oscarweb.cpp
	server/MainHandler.cpp
	server/IndexDB.cpp
	server/ItemDB.cpp
	server/GeoHierarchySubSetSerializer.cpp
	server/CQRCompleter.cpp
	server/CellQueryResultsSerializer.cpp
	server/BinaryWriter.cpp
)

set(MY_C_FLAGS "-std=c99 -fopenmp")
set(MY_CXX_FLAGS "-std=gnu++0x -fopenmp")
set(MY_DEBUG_FLAGS "-DWITH_SSERIALIZE_NORMAL_ASSERT")

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${MY_C_FLAGS}")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${MY_CXX_FLAGS}")
set(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} ${MY_DEBUG_FLAGS}")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} ${MY_DEBUG_FLAGS}")
set(CMAKE_C_FLAGS_RELWITHDEBINFO "${CMAKE_C_FLAGS_RELWITHDEBINFO} ${MY_DEBUG_FLAGS}")
set(CMAKE_CXX_FLAGS_RELWITHDEBINFO "${CMAKE_CXX_FLAGS_RELWITHDEBINFO} ${MY_DEBUG_FLAGS}")

add_subdirectory(vendor/liboscar liboscar)

SET(OSCAR_WEB_LINK_LIBS
	${liboscar_BINARY_DIR}/libliboscar.so
	${sserialize_BINARY_DIR}/libsserialize.a
	${LIBRT_LIBRARIES}
	${CPPCMS_LIBRARY}
	${BOOSTER_LIBRARY}
	"CGAL"
	"mpfr"
	"gmp"
	"boost_thread"
	"boost_system"
)

add_executable(${PROJECT_NAME} ${OSCAR_WEB_SOURCES_CPP})
add_dependencies(${PROJECT_NAME} liboscar sserialize)
target_link_libraries(${PROJECT_NAME} ${OSCAR_WEB_LINK_LIBS})
