/*
 * Event Handler Broker
 */

var EventEmitter = require('events').EventEmitter
	, path = require('path')
	, Cache = require('../utils/cache')
	, Hothub = require('./hothub')
	, MetaInfo = require('./metainfo')
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

EventBroker.prototype.configure = function(config) {
	this.root_path_ = path.join(__dirname, "../");
	this.config_path = path.join(this.root_path_, "config");

	this.capacity_ = config.capacity || 100000;
	this.handler_folder_ = path.join(this.root_path_, config.handlers || 'handlers');
	
	// init meta information
	this.meta_folder_ = path.join(this.root_path_, config.metainfo || 'metainfo');
	this.metainfo_ = new MetaInfo(this.meta_folder_);

	this.cache_ = new Cache(this.capacity_);
	this.diagnosis_ = config.diagnosis || false;
	this.diag_ = new Diagnosis(this, config["diagnosis-interval"]);
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

				// 删除information service中的缓存
				var info = self.services_.get('information');
				if (info && info.isEnabled()){
					info.removeFromTopicCache(topic);
				}				
			}

		});
	});

	// handle event classes 变更事件
	this.onMetaChanged();

	// 开始监视handler文件夹
	this.doWatch();

	// 开始监视诊断信息
	this.diagnosis();
};

EventBroker.prototype.close = function() {
	this.hothub_ && this.hothub_.close();
	this.metainfo_ && this.metainfo_.close();
};

// 
// 处理事件的主函数入口
// topic - string
// fields - object
// event_class - string
// 
EventBroker.prototype.handleEvent = function(topic, fields, event_class) {
	var handler = this.cache_.get(topic);
	var self = this;
	if (handler){
		if (handler.class == event_class) { // maybe string or undefined
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
				if (handler.inst && handler.inst.handleEvent_)
					handler.inst.handleEvent_(topic, fields);
			}
			catch(ex){ logger.debug(ex.stack); }

			// we need break the function
			return;
		}		

		// else handler.class != event_class
		// reload it
		// but firstly, we should close it for avoiding memory leaks!
		this.closeHandler(topic, handler);
	}

	// initialize handler and cache it
	this.initHandler(topic, event_class, function(handler){
		if (handler){
			//
			// 在实现滑动时间窗口模块的时候需要特别注意：
			// 滑动时间窗口在初始化载入历史和stream中的事件时，不应该包含最后一条事件。
			// 因为，这最后一条事件会在handleEvent(topic, fields)中处理，
			// 应该避免对同一个事件多次处理。
			//
			try{
				handler.inst && handler.inst.emit('message', topic, fields);
			}
			catch(ex){ logger.debug(ex.stack); }
		}
		else{
			logger.debug('Get <' + topic + '> handler failure.');
		}
	});
};

// 
// topic - string
// event_class -string
// cb - callback function (handler - object)
//
EventBroker.prototype.initHandler = function(topic, event_class, cb) {
	var self = this;
	var metainfo = this.metainfo_;

	// 读取事件主题的元数据
	// 创建处理器instance，并缓存下来
	try{
		metainfo.read(topic, event_class, function(meta){
			if (meta){
				var handler_name = meta['handler'];
				var handler = self.loadHandlerLocally(topic, event_class, handler_name);
				if (handler){
					cb && cb(handler);
					return;
				}
			}
			// failure
			logger.debug('read <' + topic + '> meta data failure.');
			cb && cb();
		});		
	}
	catch(ex){
		logger.error('Read topic meta data failure,', ex.message);
		logger.debug(ex.stack);
	}

};

// 
// topic - string
// handler - object
//
EventBroker.prototype.closeHandler = function(topic, handler) {
	// 
	// 注意：
	// 调用处理器的关闭函数，如果处理器中包含有持久化状态的需要。
	// 
	handler.inst && handler.inst.emit('close');
	this.cache_.remove(topic);
};

//
// 从本地加载事件处理器实例
// topic - string
// handler_name - string
//
EventBroker.prototype.loadHandlerLocally = function(topic, event_class, handler_name) {
	var res = path.join(this.handler_folder_, handler_name);
	try{
		var HandlerType = require(res);
		var handler = {
			'name':handler_name,
			'class':event_class,
			'id':require.resolve(res),
			'inst':new HandlerType(topic, this)
		};
		this.cache_.put(topic, handler);
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
		// 遍历cache，删除所有符合条件的topic
		var topics = self.cache_.keys();
		topics.forEach(function(topic){
			var handler = self.cache_.get(topic);
			if (!handler)
				return;
			if (ids.indexOf(handler.id) >=0 ){
				self.closeHandler(topic, handler);
			}
		});
	});
};

EventBroker.prototype.onMetaChanged = function() { 
	var self = this;
	var metainfo = this.metainfo_;

	var handle_topic_changes = function(topic){
		// 如果这个主题不在缓存中就不必费事了
		var handler =  self.cache_.get(topic);
		if (!handler)
			return;	

		metainfo.read(topic, handler.class, function(meta) {			
			if (!meta || meta['handler'] != handler.name){
				// 
				// 注意：
				// 调用处理器的关闭函数，如果处理器中包含有持久化状态的需要。
				// 
				self.closeHandler(topic, handler);
			}
		});
	};

	// 如果metainfo服务重新载入
	metainfo.on('changed', function(){
		var topics = self.cache_.keys();
		topics.forEach(function(topic){
			handle_topic_changes(topic);
		});
	}); 
};

EventBroker.prototype.diagnosis = function() {
	var self = this;
	if (this.diagnosis_) {
		this.diag_.run();
	}
};