module.exports = {
	"appenders" : [
		{
			"type" : "logLevelFilter",
			"level" : "INFO",			
			"appender" : {
				"type" : "file",
				"filename" : "ces/log/serv.log",
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