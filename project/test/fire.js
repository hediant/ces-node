var StreamAPI = require('amqp-subpub');
var config = require('../config/services/eventstream');
var stream = new StreamAPI(config.stream_server.url, config.stream_server.options);

var count = 1;
var tagcount = 2;
var topics = [];
for (var i=1; i<=count; i++){
	topics.push('test' + i);
}
var x = 0, y = 0, i = 0;

setInterval(function(){
	var d = new Date();
	var evs = [];
	topics.forEach(function(topic){
		var ev = {
			"topic" : topic,
			"class" : "demo",
			"fields" : {
				"data":{'bad_tag':'-'},
				"recv":d.valueOf(),
				"source":d.valueOf(),
				"quality":{
					'bad_tag':'NOT_CONNECTED'
				}
			}
		};
		for (var i=0; i<tagcount; i++){
			ev.fields.data['tag'+i] = i;
		}

		evs.push(ev);
	});


	// 给所有已经连接上的客户端发送
	var start = (new Date()).valueOf();
	for (var i=0; i<evs.length; i++) {
		var evt_ = evs[i];
		stream.write(evt_.topic, evt_.class, evt_.fields);
	}		
	var end = (new Date()).valueOf();
	console.log('%s fire %s events, %s tags per event, %s ms', 
		(new Date()).valueOf(), evs.length, tagcount, (end-start));

}, 1000);