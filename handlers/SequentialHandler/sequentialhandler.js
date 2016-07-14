var BaseHandler = require('../BaseHandler');

//
// 从这个处理器继承的对象，将会按顺序处理到达的事件（消息）
// 如果一个事件（消息）正在处理，新的事件（消息）到达将会被放到队列中
// 超出队列最大长度（max_queue_len_）的事件（消息）将会被丢弃
// 一个事件（消息）处理完后必须调用this.nextEvent()方法，以便在nextTick处理下一条事件（消息）
//
function SequentialHandler(topic, broker) {
	BaseHandler.call(this, topic, broker);

	this.max_queue_len_ = 10;
	this.queue_ = [];
	this.busy_ = false;
}
require('util').inherits(SequentialHandler, BaseHandler);
SequentialHandler.prototype.constructor = SequentialHandler;

module.exports = SequentialHandler;

SequentialHandler.prototype.handleEvent_ = function(topic, fields) {
	if (!this.busy_) {
		this.busy_ = true;
		this.emit('message', topic, fields);
		return;
	}

	// if busy
	// we will queue the event (message)
	if (this.queue_.length < this.max_queue_len_) {
		this.queue_.push({
			topic : topic,
			fields : fields
		});
	}
};

SequentialHandler.prototype.nextEvent = function() {
	var self = this;
	if (this.queue_.length) {
		var evt = this.queue_.shift();
		setImmediate(function(){
			self.emit('message', evt.topic, evt.fields);
		});
	}
	else{
		this.busy_ = false;
	}
};