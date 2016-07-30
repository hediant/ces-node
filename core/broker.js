/*
 * Event Handler Broker
 */

var EventEmitter = require('events').EventEmitter
	, path = require('path')
	, Cache = require('../utils/cache')
	, Hothub = require('./hothub')
	, Route = require('./route')
	, Diagnosis = require('./diagnosis');

function EventBroker(recv, sender, services){
	EventEmitter.call(this);

	this.recv_ = recv;
	this.sender_ = sender;
	this.services_ = services;
}
require('util').inherits(EventBroker, EventEmitter);
module.exports = EventBroker;
EventBroker.prototype.constructor = EventBroker;

EventBroker.prototype.configure = function(work_path) {
	this.capacity_ = config.broker.capacity || 100000;
	this.handler_folder_ = path.join(work_path, config.broker.handlers || 'handlers');

	this.cache_ = new Cache(this.capacity_);
	this.diagnosis_ = config.diagnosis.enabled || false;
	this.diag_ = new Diagnosis(this, config.diagnosis.interval);
};

EventBroker.prototype.run = function() {
	var self = this;
	this.recv_.on('message', function(topic, fields, event_class){
		self.handleEvent(topic, fields, event_class);
	});

	this.recv_.on('fetch', function(hashing, nodeid){
		var topics = self.cache_.keys();
		topics.forEach(function(topic){
			if (hashing.getNode(topic) != nodeid){
				// 如果不是本节点需要处理的事件则删除之
				var handler = self.cache_.get(topic);
				if (handler){
					handler.inst && handler.inst.emit('close');
					self.cache_.remove(topic);
				}
			}

		});
	});

	// 开始监视handler文件夹
	if (config.broker.watch)
		this.doWatch();

	// 开始监视诊断信息
	this.diagnosis();
};

EventBroker.prototype.close = function() {
	this.hothub_ && this.hothub_.close();
};

// 
// 处理事件的主函数入口
// topic - string
// fields - object
// event_class - string
// 
EventBroker.prototype.handleEvent = function(topic, fields, event_class) {
	var self = this;
	var uri = Route.routeUri(topic, event_class);
	var handler = this.cache_.get(uri);	
	if (!handler){
		// initialize handler and cache it
		handler = this.initHandler(uri, topic, event_class);		
	}
	
	if (handler){
		try{
			// 
			// 采用事件驱动方式的好处是给调用者更大的选择
			// 如：可以对一个事件做多个处理（采用handler继承的方式）
			// 但这样更容易犯错
			// 而采用直接函数调用的方式能够确保同一个事件只会在一个EventHandler中处理
			// 好坏优劣待定。
			//
			// 这里默认采用的是后者
			//
			//
			// 在实现滑动时间窗口模块的时候需要特别注意：
			// 滑动时间窗口在初始化载入历史和stream中的事件时，不应该包含最后一条事件。
			// 因为，这最后一条事件会在handleEvent(topic, fields)中处理，
			// 应该避免对同一个事件多次处理。
			//
			if (handler.inst && handler.inst.handleEvent_)
				handler.inst.handleEvent_(topic, fields);
		}
		catch(ex){ logger.debug(ex.stack); }

		// we need break the function
		return;
	}
	else{
		logger.debug('Route "' + uri + '" unavailable.');
	}
};

// 
// topic - string
// event_class -string
// cb - callback function (handler - object)
//
EventBroker.prototype.initHandler = function(uri, topic, event_class) {
	var self = this, handler;

	// 读取事件主题的元数据
	// 创建处理器instance，并缓存下来
	var match = Route.match(uri);
	if (match){
		var handler = self.loadHandlerLocally(topic, event_class, match);
	}
	
	return handler;
};

// 
// topic - string
// handler - object
//
EventBroker.prototype.closeHandler = function(handler) {
	// 
	// 注意：
	// 调用处理器的关闭函数，如果处理器中包含有持久化状态的需要。
	// 
	handler.inst && handler.inst.emit('close');
};

//
// 从本地加载事件处理器实例
// topic - string
// handler_name - string
//
EventBroker.prototype.loadHandlerLocally = function(topic, event_class, match) {
	var res = path.join(this.handler_folder_, match.handler);
	try{
		var HandlerType = require(res);
		var handler = {
			'topic' : topic,
			'name' : match.handler,
			'class' : event_class,
			'id' : require.resolve(res),
			'inst' : new HandlerType(topic, this)
		};

		this.cache_.put(match.uri, handler);
		return handler;
	}
	catch(ex){
		logger.error('Can\'t load module ' + res);
		logger.debug(ex.stack);
	}
	return null;
};

EventBroker.prototype.doWatch = function() {
	var hothub = new Hothub(this.handler_folder_)
		,self = this;
	this.hothub_ = hothub;

	logger.info('Watching at', path.resolve(this.handler_folder_));
	hothub.on('change', function(ids){
		// 遍历cache，删除所有符合条件的uri(class/topic)
		var uris = self.cache_.keys();
		uris.forEach(function(uri){
			var handler = self.cache_.get(uri);
			if (!handler)
				return;

			//
			// 如果变化的handler在cache中, 则closeHandler并从cache中删除
			//
			if (ids.indexOf(handler.id) >=0 ){
				self.closeHandler(handler);
				self.cache_.remove(uri);
			}
		});
	});
};

EventBroker.prototype.diagnosis = function() {
	var self = this;
	if (this.diagnosis_) {
		this.diag_.run();
	}
};