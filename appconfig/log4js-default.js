var path = require('path');

module.exports = {
	"appenders" : [
		{
			"type" : "logLevelFilter",
			"level" : "INFO",			
			"appender" : {
				"type" : "file",
				"filename" : path.join(__dirname, "../log/serv.log"),
				"maxLogSize" : 1048576,
				"backups" : 10
			}
		},
		
		{
			"type" : "logLevelFilter",
			"level" : "DEBUG",			
			"appender" : {
				"type" : "console"
			}
		}
		
	]
};