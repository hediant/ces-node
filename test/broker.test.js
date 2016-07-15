var Broker = require('../core/broker');
var EventEmitter = require('events').EventEmitter;
var ServMgr = require('../core/servicesmgr');
var Receiver = require('../core/recv');
var Sender = require('../core/sender');

var logger_cfg = {
	"appenders" : [
		{
			"type" : "logLevelFilter",
			"level" : "DEBUG",			
			"appender" : {
				"type" : "console"
			}
		}
	]
};
require('../utils/logger').use(logger_cfg, 'broker-test');

var topics = ['test01', 'bench01'];


var services = ServMgr.create('../services', {})
services.preload(function(){
	var eventstream = services.get('eventstream');
	var recv = new Receiver(eventstream);	// Singlton mode
	var sender = new Sender(eventstream);	// Singlton mode

	//
	// create and init broker object
	//
	var broker = new Broker(recv, sender, services);
	broker.configure({
		"capacity":100000,
		"handlers":"/handlers",
		"metainfo":"/metainfo",
		"diagnosis" : true
	});	// use default

	// run
	broker.run();
	var x=0, y=0;

	setInterval(function(){
		var d = new Date();
		topics.forEach(function(topic){
			recv.dispose([
				{
					"topic":topic,
					"class":"demo",
					"fields":{
						"data":{'x':++x, 'y':--y, 'bad_tag':'-'},
						"recv":d.valueOf(),
						"source":d.valueOf(),
						"quality":{
							'bad_tag':'NOT_CONNECTED'
						}						
					}				
				}
			]);		
		});

	}, 1000);	
});


