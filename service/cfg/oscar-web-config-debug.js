{
    "service" : {
        "api" : "fastcgi",
        "socket" : "./oscar.sock"
    },
    "gzip" : {
        "level" : 1,
        "enable" : true
    },
    "http" : {
        "script" : "/oscar"
    },
    "localization" : {
        "locales" : [ "de_DE.UTF-8" ]
    },
    "logging" : {
        "level" : "debug",
        "file" : {"name" : "./log/cppcms.log", "append" : true }
    },
    "dbfile" :
        {   "name" : "Planet",
            "path" : "./searchfiles",
            "logfile": "./log/search.log",
            "limit" : 128,
            "chunklimit" : 8,
            "fullsubsetlimit" : 10000,
            "maxindexdbreq": 1000,
            "maxitemdbreq": 2000,
			"maxresultdownloadsize" : 1000000,
			"cachedGeoHierarchy" : true,
            "itemstextcompleter" : 0,
            "geotextcompleter" : 0,
            "geocompleter" : 0,
	    	"treedCQR" : true,
			"treedCQRThreads": 2,
			"preload" : ["index", "kvstore", "textsearch"],
			"celldistance" : "mass"
        },
    "ghfilters" :
		[
			{"name" : "admin_level", "k" : ["admin_level"]}
		]
}

