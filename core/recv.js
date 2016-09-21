/*
 * Events receiver
 */

var EventEmitter = require('events').EventEmitter
	, ConsistentHashing = require('consistent-hashing')
	, Route = require('./route');

function EventReceiver(event_stream, applier){
	this.event_stream_ = event_stream;
	this.applier_ = applier;

	// for diagnosis
	this.recv_counter_ = 0;

	this.init();
}
require('util').inherits(EventReceiver, EventEmitter);
module.exports = EventReceiver;

EventReceiver.prototype.init = function() {
	var self = this;
	if (!this.event_stream_){
		logger.error('Event Streaming Error. Process must exit.');
		process.exit(1);
	}

	///////////////////////////////////////////////
	// NOTE：
	// 如果指定了加入集群的applier则启动集群模式
	// 否则启动单进程工作模式
	//
	if (this.applier_) {
		// 初始化一致性哈希和集群节点
		this.inithashing();
	}

	//
	// 开始订阅事件
	//
	function dosub() {
		self.event_stream_.sub(function(events){
			self.dispose(events);
		})
	}

	// do subscribe
	dosub();
};

EventReceiver.prototype.inithashing = function() {
	//
	// 初始化一致性哈希
	//
	// 默认使用的160份冗余（replicas），哪样太慢了，虽然随机性更好。
	// 这里使用冗余份数为3，会比replicas=160快很多
	// 尽管如此，用nodejs实现的consistent-hashing还是很慢
	// 必要的时候用C++重写 
	//
	var nodes = Object.keys(this.applier_.executors_)
		, self = this;
	this.nodeid_ = this.applier_.nodeid;
	this.hashing_ = new ConsistentHashing(nodes, {"replicas" : 3}); 
	
	// 注册集群事件处理器
	this.applier_.on('removed', function(nodeid){
		// 
		// 由于集群中移除节点，根据一致性哈希算法，当前节点需要处理的topic只会增加不会减少
		// 因此，这种情况不需要对正在处理的事件topic做筛选。
		//
		self.hashing_.removeNode(nodeid);
	});

	this.applier_.on('added', function(nodeid){
		self.hashing_.addNode(nodeid);
		//
		// 特别注意！！
		// broker 需要根据新的hashing对缓存中的topic进行清理。
		//
		self.emit('fetch', self.hashing_, self.nodeid_);

		//
		// 执行投票，需要注意的是：
		// 这个过程可以不等broker清理完成，因为hashing已经更改
		// 但是我们需要释放这块资源，同时防止topic的重入问题。
		//
		self.applier_.vote(self.nodeid_, function(){
			logger.debug('Node #%s voted when node #%s added.', self.nodeid_, nodeid);
		});		
	});
};

EventReceiver.prototype.dispose = function(events) {
	var self = this;
	var send_ = function(topic, fields, event_class) {
		//
		// 避免一次事件处理阻塞进程
		//
		setImmediate(function(){
			// for diagnosis
			self.recv_counter_ ++;			
			self.emit('message', topic, fields, event_class);
		});		
	};

	if (Array.isArray(events)){
		events.forEach(function(evt){
			var topic = evt.topic;
			if (!topic)
				return;
			
			if (self.applier_){ // Cluster mode
				var uri = Route.routeUri(topic, evt.class);
				var hash = self.hashing_.getNode(uri);
				if (hash == self.nodeid_){
					send_(topic, evt.fields, evt.class);					
				}				
			}
			else{ // Stand-alone mode
				send_(topic, evt.fields, evt.class);
			}

		});
	}
	else{
		this.dispose([events]);
	}
};