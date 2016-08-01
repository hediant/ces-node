var io = require('socket.io-client');
var EventEmitter = require('events').EventEmitter;

/*
evt定义
{
	"topic":"<topic_name>",
	"class":"athena.real",
	"fields":{
		"data":{
			"devid.pointid":"<tag_value>",
			"1.1":13.888,
			... ...
		},
		"recv":"<服务器接收时间，如：1412905743720>",
		"source":"<源时间戳（或者设备时间戳）>",
		"quality":{
			"tag2":"BAD",
			...
		},
		"sender":"<发送者ID>",
		"server":"<服务器ID>"
	}
}
*/

var StreamAPI = function (ioUrl, fetch_interval) {
	EventEmitter.call(this);
	
	var self = this;
	var lastVer = 0;
	var isClose = false;

	var isConnected = false;

	var removeList = [];
	var pullCount = 0;
	var lastReadCount = 0;
	var readvDone = true;

	var ioClient = io.connect(ioUrl,{forceNew:true});

	// for sub/pub
	var fetch_interval_ = fetch_interval || 50;  // defaults to 50ms
	var interval_ = null;

	/*
	初始连接上时 通知connect
	服务器断开后 通知disconnect
	服务器可以连接时 通知reconnect->再通知connect
	*/
	ioClient.on('connect', function(){
		isConnected = true;
		self.emit('connect');
	});
	ioClient.on('reconnect', function(){
		self.emit('reconnect');
	});
	ioClient.on('disconnect', function(){
		isConnected = false;
		self.emit('disconnect');
	});

	this.close = function(){
		isClose = true;
		this.unsub();
		ioClient.destroy();
	}
	
	this.write = function(topic, evtClass, fields){
		ioClient.emit('write', topic, evtClass, JSON.stringify(fields));
	}

	//读取topic begin到end时间段发生的事件
	this.range = function(topic, begin, end, callback){
		ioClient.emit('range', topic, begin, end, function(err, evtList){
			evtList = JSON.parse(evtList);
			callback(err, evtList);
		});
	}
	
	var pull = function(){
		if (!isConnected) {
			return ;
		};

		var count = ++pullCount;
		if (!readvDone) {
			if (count - lastReadCount > 50) {
				removeList[lastReadCount] = true;
			}
			else{
				return ;
			}
		};
		lastReadCount = count;
		readvDone = false;
		ioClient.emit('readv', lastVer, function(err, newVer, evtList){
			if (removeList[count]) {
				delete removeList[count];
				return ;
			};
			readvDone = true;
			lastVer = newVer;
			if (isClose) {
				return ;
			};
			evtList = JSON.parse(evtList);
			if (evtList && evtList.length>0) {
				self.emit('data', evtList);
			};
		});
	}

	// 订阅新的事件通知
	this.sub = function(){
		if (interval_)
			return;

		interval_ = setInterval(pull, fetch_interval_);
	};

	// 取消订阅新的事件通知
	this.unsub = function() {
		if (interval_)
			clearInterval(interval_);
		interval_ = null;
	}
}

require('util').inherits(StreamAPI, EventEmitter);
module.exports = StreamAPI;