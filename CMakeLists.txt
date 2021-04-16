cmake_minimum_required(VERSION 3.16)
project(oscar-web)

set(CMAKE_MODULE_PATH
	${CMAKE_CURRENT_SOURCE_DIR}/cmake/
	${CMAKE_CURRENT_SOURCE_DIR}/vendor/liboscar/cmake/
	${CMAKE_CURRENT_SOURCE_DIR}/vendor/liboscar/vendor/sserialize/cmake/
)

option(OPTIMIZE_ULTRA "Build oscar-web with lto and aggressive optimization settings for sserialize")
if (OPTIMIZE_ULTRA)
	set(LIBOSCAR_NO_DATA_REFCOUNTING_ENABLED TRUE)
	set(SSERIALIZE_INLINE_IN_LTO_ENABLED TRUE)
	set(SSERIALIZE_CONTIGUOUS_UBA_ONLY_SOFT_FAIL_ENABLED TRUE)
	set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)
endif()

add_subdirectory(vendor/liboscar liboscar)
add_subdirectory(vendor/path_finder)
find_package(CPPCMS REQUIRED)
find_package(LIBRT)

set(OSCAR_WEB_SOURCES_CPP
	server/ItemSerializer.cpp
	server/GeoHierarchySubSetSerializer.cpp
	server/CellQueryResultsSerializer.cpp
	server/BinaryWriter.cpp
	server/IndexDB.cpp
	server/ItemDB.cpp
	server/CQRCompleter.cpp
	server/CQRItems.cpp
	server/oscarweb.cpp
	server/MainHandler.cpp
	server/KVClustering.cpp
	server/Routing.cpp
	server/BaseApp.cpp
)
SET(OSCAR_WEB_LINK_LIBS
	liboscar
	sserialize
	path_finder
	${LIBRT_LIBRARIES}
	${CPPCMS_LIBRARY}
	${BOOSTER_LIBRARY}
)

add_executable(${PROJECT_NAME} ${OSCAR_WEB_SOURCES_CPP})
target_link_libraries(${PROJECT_NAME} ${OSCAR_WEB_LINK_LIBS})
