var EventEmitter = require('events').EventEmitter;
var zookeeper = require('node-zookeeper-client');

function DistMetux(zkClient){
	EventEmitter.call(this);

	this.zkClient_ = zkClient;
	this.base_metux_path = '/mutex/';

	this.locked = {};
}
require('util').inherits(DistMetux, EventEmitter);
DistMetux.prototype.constructor = DistMetux;

module.exports = DistMetux;

DistMetux.prototype.try = function(key, cb) {
	console.assert(!this.locked[key], 'Must release mutex('+key+') before you try.');

	var self = this,
		metux_path = this.base_metux_path + key;

	this.zkClient_.create(metux_path,
		null,
		zookeeper.CreateMode.EPHEMERAL,
		function(error, fullpath){
			if (error){
				if (error.name == 'NODE_EXISTS'){
					self.zkClient_.exists(metux_path,
						function(event){ // watch
							// if NODE_DELETED, we retry again.
							if (event.name == 'NODE_DELETED' && !self.locked[key]) self.try(key, cb);
						},
						function(error, stat){
							if (error){
								logger.error('Try metux %s failure %j', metux_path, error.stack);
								self.emit('error', error);
								return;
							}

							if (!stat){ 
								// if not exist, re-try again.
								self.try(key, cb);
							}
						}
					);
				}
				else{ // error.name != 'NODE_EXISTS' or unknown error
					logger.error('Try metux %s failure %j', metux_path, error.stack);
					self.emit('error', error);
					return;
				}
			}
			else{
				// no errors
				self.locked[key] = true;
				cb && cb();
			}
		}
	);
};

DistMetux.prototype.release = function(key, cb) {
	console.assert(this.locked[key], 'Must try mutex('+key+') before you release it.');

	var self = this;
	var mutex_path = this.base_metux_path + key;
	this.zkClient_.remove(mutex_path, -1, function(error){
		if (error && error.name != 'NO_NODE'){
			// 如果不是删除的节点不存在
			logger.error('release %s error %j', mutex_path, error.stack);
			self.emit('error', error);
			return;
		}

		delete self.locked[key];
		cb && cb();
	});
};

