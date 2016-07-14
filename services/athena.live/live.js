/*
 * snapshot wrapper class
 */

var BaseService = require('../../common/baseservice')
	, redis = require('redis')
	, Live = require('../../../live');

var Values = Live.SystemValues;
var Status = Live.SystemStatus;

//
// folder - string, 该服务所在的绝对路径
//
function Snapshot(folder, config){
	BaseService.call(this, folder, config, 'athena.live');

	var self = this;
	this.on('init', function(){
		self.init();
	});

	// 不要忘记响应关闭事件
	this.on('close', function(){
		self.redisClient_ && self.redisClient_.end();
		if (self.timer_)
			clearInterval(self.timer_);
		self.removeAllListeners();
	});	

    this.event_queue_ = [];
    this.delayed_queue_size_ = 100;
    this.time_to_send_ = 50;	// defaults to 50 ms

    this.timer_;
}
require('util').inherits(Snapshot, BaseService);
Snapshot.prototype.constructor = Snapshot;
module.exports=Snapshot;

Snapshot.prototype.init = function() {
	var self = this;

	// 需要公开访问的服务的方法在这里定义
	this.public_ = {
		'setSystemValues':this.setSystemValues,
		'setSystemsValues':this.setSystemsValues,
		'getSystemValues':this.getSystemValues,
		'setSystemStatus' : this.setSystemStatus,
		'getSystemsStatus' : this.getSystemsStatus
	};

	// 当初始化完成后，需要触发ready事件通知框架
	this.doConnect(function(){
		self.emit('ready');	
	});

    this.timer_ = setInterval(function(){
        if (self.event_queue_.length){
            self.setSystemsValues(self.event_queue_, function(err, reply){
                // do nothing
                //if (err)
                //	logger.debug("Take live snapshot pipeline failure.", err, reply);
            });
        }
        self.event_queue_=[];
    }, this.time_to_send_);

};

Snapshot.prototype.doConnect = function(cb) {
	// redis.createClient连接失败的情况下不会抛异常，并且会创建redisClient对象
	// 由redisClient.on('error',...)负责处理
	// By default client will try reconnecting until connected.
	// 这个重连由node-redis自己完成
	var addr = this.config_.addr || "localhost";
	var port = this.config_.port || 6379;
	var auth_pass = {auth_pass:this.config_.auth_pass};
	
	this.redisClient_ = redis.createClient(port, addr,auth_pass);

	// set connection
	Live.setRedisConnection(this.redisClient_);

	//this.redisClient_ = redis.createClient(port, addr);
	this.redisClient_.on('ready', function(){
		cb && cb();
	});

	// 添加错误处理函数
	this.addErrorHandler();
};

Snapshot.prototype.addErrorHandler = function(){
	var self = this;

	this.redisClient_.on('error', function(err){
		// 监听error事件，意味着redis模块将会自动重连
		// self.emit('error', err.message);
		logger.error('service <%s> connection error:%s.', self.name_, err.message);
	});
	
	this.redisClient_.on('end', function(){
		// TODO
		// 如果用户主动中断连接则不应该重连。
		logger.debug('service <%s>, user end connection.', self.name_);
	});
};

// 
// topic - string
// fields - object
// 
Snapshot.prototype.setSystemValues = function(system_id, fields, cb){
	// 保存到当前值
    this.event_queue_.push({
        "system_id" : system_id,
        "fields" : fields
    });

    if (this.event_queue_.length < this.delayed_queue_size_){
        cb && cb(null);
    }
    else{
        this.setSystemsValues(this.event_queue_, cb);
        this.event_queue_ = [];
    }
};

//
// event_queue - array
// item 必须包括{topic(string), fields(object)}
// 
Snapshot.prototype.setSystemsValues = function(event_queue, cb){
	var service_ = Values;
	service_.setSystemsValues(event_queue, cb);
};

// 
// system_id - string
// [id - tag name, string]
// cb - function(err, obj)
// 
Snapshot.prototype.getSystemValues = function() {
	var service_ = Values;
	switch(arguments.length){
		case 2:
			// system_id, callback
			return service_.getSystemValues(arguments[0], arguments[1]);
		case 3:
			// system_id, tag_names - array, callback
			return service_.getSystemValues(arguments[0], arguments[1], arguments[2]);
		default:
			cb && cb(null);
	}
};

Snapshot.prototype.setSystemStatus = function(system_id, status, cb) {
	var service_ = Status;
	service_.setSystemStatus(system_id, status, cb);
};

Snapshot.prototype.getSystemsStatus = function(system_ids, cb) {
	var service_ = Status;
	service_.getSystemsStatus(system_ids, cb);
};





