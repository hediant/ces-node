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

var services = ServMgr.create('../services', {});
services.preload(function(){
	var eventstream = services.get('eventstream');
	var recv = new Receiver(eventstream);	// Singlton mode
	var sender = new Sender(eventstream);	// Singlton mode

	var broker = new Broker(recv, sender, services);
	broker.configure({
		"capacity":100000,
		"handlers":"../handlers",
		"metainfo":"../metainfo",
		"diagnosis" : true
	});	// use default
	broker.run();

	var count = 10000;
	var tagcount = 100;

	// 创建count个主题
	console.time('create ' + count + ' topics');
	var topics = [];
	for(var i=0; i<count; i++){
		topics.push('bench'+i);
	}
	console.timeEnd('create ' + count + ' topics');

	setInterval(function(){
		var d = new Date();
		var tm = d.valueOf();

		var mark = 'write ' + count + ' events';
		var start = (new Date()).valueOf();
		
		for (var i=0; i<count; i++){	
			var ev = {
				"data":{'bad_tag':'-'},
				"recv":tm,
				"source":tm - 1000 * Math.random(),
				"quality":{
					'bad_tag':'NOT_CONNECTED'
				}
			};

			for (var j=0; j<tagcount; j++){
				ev.data['tag'+j] = j;
			}

			recv.dispose({
				// 这里通过rules匹配，而不是通过eventclasses去匹配
				// 如果指定了event class则会通过eventclasses去匹配
				"topic":topics[i], 
				"fields":ev
			});
		}
		
		var end = (new Date()).valueOf();
		logger.debug('Write %s * %s tags, %s ms.', count, tagcount, end-start);

	}, 1000);
});

