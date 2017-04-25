/*
 * event handler base class
 */

var EventEmitter = require('events').EventEmitter;

//
// 事件处理器基类
// 
function BaseHandler(topic, broker, event_class){
	EventEmitter.call(this);

	this.broker_ = broker;
	this.event_class = event_class;
	this.receiver = broker.recv_;
	this.sender = broker.sender_;
	this.topic = topic;
};

require('util').inherits(BaseHandler, EventEmitter);
module.exports = BaseHandler;

// 
// 说明：
// 子类需要订阅如下事件：
// message - 有新的事件到达需要处理，参数(topic, fields)
// close - 事件处理器需要关闭，参数()
//

BaseHandler.prototype.constructor = BaseHandler;

BaseHandler.prototype.handleEvent_ = function(topic, fields) {
	this.emit('message', topic, fields);
};

BaseHandler.prototype.getBroker = function(){
	return this.broker_;
}

BaseHandler.prototype.getSender = function(){
	return this.sender;
}

BaseHandler.prototype.getEventClass = function(){
	return this.event_class;
}

BaseHandler.prototype.getTopic = function(){
	return this.topic;
}



