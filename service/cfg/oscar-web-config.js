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
            "itemstextcompleter" : 0,
            "geotextcompleter" : 0,
            "geocompleter" : 0,
	    "treedCQR" : false
        },
    "ghfilters" :
		[
			{"name" : "admin_level", "k" : ["admin_level"]},
			{
				"name" : "natural_landuse", "k" : ["natural", "landuse"],
				"kv" : { "admin_level" : ["1", "2", "3", "4", "5", "6"] }
			},
			{"name" : "named", "k" : ["name"]}
		]
}

