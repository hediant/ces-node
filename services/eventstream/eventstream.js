/*
 * event streaming service wrapper class
 */

var BaseService = require('../../common/baseservice')
	, StreamAPI = require('../../../stream').StreamAPI
	, async = require('async');

//
// 事件处理器基类
// folder - string, 该服务所在的绝对路径
//
function EventStream(folder, config){
	BaseService.call(this, folder, config, 'eventstream');

	var self = this;
	this.is_subing_ = false;

	this.on('init', function(){
		self.init(config);
	});

	// 不要忘记响应关闭事件
	this.on('close', function(){
		self.close();
	});
};
require('util').inherits(EventStream, BaseService);
EventStream.prototype.constructor = EventStream;
module.exports=EventStream;

EventStream.prototype.close = function() {
	// cancel subscribe
	this.unsub();

	// cancel stream's listeners
	if (this.stream_) {
		this.stream_.close();
		this.stream_.removeAllListeners();
	}

	if (this.interval_){
		clearInterval(this.interval_);
	}
	this.removeAllListeners();
};

EventStream.prototype.init = function(config) {
	var self = this;

	// todo
	// 需要公开访问的服务的方法在这里定义
	this.public_ = {
		'sub' : this.sub,
		'unsub' : this.unsub,
		'fire' : this.fire
	};

	// 初始化发送事件队列
	this.initEventQueue(config);

	// 当初始化完成后，需要触发ready事件通知框架
	this.doConnect(config, function(){
		self.emit('ready');
	});	
	
};

EventStream.prototype.initEventQueue = function(config) {
	var self = this;	
	//
	// max_len 最大发送队列长度，当设置为1时表示立刻发射事件
	// max_time_to_fire 表示最大多长时间检查一次发射队列，默认为1毫秒
	//
	this.config_.max_len = this.config_["max_len"] || 1;
	this.config_.max_time_to_fire = this.config_["max_time_to_fire"] || 1;

	this.event_queue_ = [];
	this.interval_ = setInterval(function(){
		self.fireImmediatelly();
	}, this.config_.max_time_to_fire);	

};

EventStream.prototype.doConnect = function(config, cb) {
	var self = this;
	this.config_.stream_server = config["stream_server"] || ["http://localhost:10016"];
	this.stream_ = new StreamAPI(
		this.config_.stream_server[0],
		this.config_.pull_interval
	);

	this.stream_.on('connect', function(){
		logger.info("service <%s> connect to stream server: %s.", self.name_, self.config_.stream_server);

		// begin subscribe events
		self.stream_.sub();
		cb && cb();
	});

	this.stream_.on('reconnect', function(){
		logger.info("service <%s> connect to stream server: %s.", self.name_, self.config_.stream_server);
		cb && cb();
	});

	this.stream_.on('disconnect', function(){
		logger.info("service <%s> disconnect from stream server: %s.", self.name_, self.config_.stream_server);

		// stop subscribe events
		self.stream_.unsub();
	});

	this.stream_.on('error', function(err){
		// if we listen error event, then
		// stream_ will re-connect automentically
		logger.info("service <%s> error: %s.", self.name_, err.message);

		// stop subscribe events
		self.stream_.unsub();

		// do nothing
		// self.emit('error', err);
	});
};

EventStream.prototype.sub = function(cb) {
	if (this.is_subing_)
		return;

	this.is_subing_ = true;
	this.stream_.on('data', function(events){
		cb && cb(events);
	});
};

EventStream.prototype.unsub = function() {
	var listeners = this.stream_.listeners('data')
		, self = this;
	if (!this.is_subing_)
		return;

	// set signal
	this.is_subing_ = false;

	if (listeners){
		listeners.forEach(function(listener){
			self.stream_.removeListener('data', listener);
		});
	}
};

EventStream.prototype.fire = function(topic, event_class, fields) {
	if (typeof topic !== "string") {
		throw TypeError("topic must be a string.");
	}
	if (typeof fields !== "object") {
		throw TypeError("fields must be an object.");
	}

	this.event_queue_.push({
		"topic" : topic,
		"class" : event_class,
		"fields" : fields
	});
	
	if (this.event_queue_.length >= this.config_.max_len){
		this.fireImmediatelly();
	}
};

EventStream.prototype.fireImmediatelly = function() {
	var self = this;
	if (this.event_queue_.length) {		
		this.event_queue_.forEach(function(evt){
			self.stream_.write(evt.topic, evt.class, evt.fields);
		});
		this.event_queue_ = [];
	}
};