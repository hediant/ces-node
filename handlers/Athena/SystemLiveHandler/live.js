var SequentialHandler = require('../../SequentialHandler')
	, Topic = require('../../../../common/topic')
	, Async = require('./async')
	, co = require('co')
	, Q = require('q')
	, System = require('./system')
	, isValidData = require('./valid_data');

function SystemLiveHandler (topic, broker) {
	var self = this;
	SequentialHandler.call(this, topic, broker);

	// Add your own initialize functions here
	this.on('message', this.handleEvent);

	// Close when handler destroy
	this.on('close', function(){
		self.removeAllListeners();
	});

	// current system
	this.the_system_ = null;
};
require('util').inherits(SystemLiveHandler, SequentialHandler);
SystemLiveHandler.prototype.constructor = SystemLiveHandler;

module.exports = SystemLiveHandler;

SystemLiveHandler.prototype.handleEvent = function (topic, fields) {
	var self = this
		, services = this.services;

	co(function *(){
		var system_id = Topic.systemUuid(topic);
		var sys_info = yield self.readSystem(system_id);
		if (!sys_info){
			if (self.the_system_){
				self.the_system_.release();
				self.the_system_ = null;
			}

			// system NOT exist or not active
			return self.nextEvent();
		}

		if (sys_info.state != 1){
			return self.nextEvent();
		}

		// 判断the_system是否存在或者是否需要更新
		if (!self.the_system_ || 
			self.the_system_.version < sys_info.version){
			if (self.the_system_)
				self.the_system_.release();

			self.the_system_ = new System(sys_info);
			self.the_system_.on('status', function (status){
				self.writeSystemStatus(system_id, status);
				self.notify();
			});

			// 从snapshot库(redis)中装载上一次的值
			var last_values = yield self.loadFromSnapshot(system_id);
			if (last_values){
				// last_values是以id为key的
				var attrs = self.the_system_.getAttributes();
				for (var name in attrs){
					var attr = attrs[name];					
					var last = last_values[attr.id];
					if (last){
						// 将上一次的值写入到滑动时间窗口中
						attr.setPair(last.val, last.ts);
						attr.reset();
					}
				}

				// 
				// NOTE:
				//   处理上一刻的报警状态(但是不要发通知)
				//   这样, 当trigger.type=="once"的情况下, 不会因为the_system的重新载入而重复触发报警
				//
				self.the_system_.notify();
			}			
		}

		// 更新状态
		self.the_system_.fetchStatus({online : 1});

		// 判断是否有数据需要处理
		if (!fields || !fields.data)
			return self.nextEvent();

		// 将数据写到the_system的滑动时间窗口中
		var ts = fields.recv || Date.now();
		for (var key in fields.data){
			var val = fields.data[key];
			if (isValidData(val)){
				self.the_system_.setValue(key, val, ts);
			}
		}

		// 将数据写到快照中
		yield self.takeSnapshot(system_id);

		// 将数据写到历史库中,如果有需要保存历史的数据
		yield self.saveLog(system_id, ts);

		// 处理触发器, 如果满足条件发送通知
		yield self.notify();

		//
		// NOTE:
		//	DON'T FORGOT !!!	
		// 	重置the_system, 以便处理新的事件. && self.nextEvent()
		//
		self.the_system_.reset();
		self.nextEvent();
	})
	.catch ((err) => {
		console.log("Handle topic: %s error:%s.", topic, err);
		if (err.stack){
			console.log(err.stack);
		}

		// Don't forgot
		if (self.the_system_)
			self.the_system_.reset();

		self.nextEvent();
	});

};

SystemLiveHandler.prototype.readSystem = function(system_id) {
	var self = this;
	return Q.Promise((resolve, reject) => {
		var service = self.services.get("athena.info");
		if (service && service.isEnabled()){
			service.readSystem(system_id, function (err, system_info){
				if (err){
					console.log("Read system %s err:%s.", system_id, err);
					reject(err);
				}
				else
					resolve(system_info);
			})
		}
		else{
			reject("Service athena.info is NOT enabled!");
		}
	})	
};

SystemLiveHandler.prototype.loadFromSnapshot = function(system_id) {
	var self = this;
	return Q.Promise((resolve, reject) => {
		var service = self.services.get("athena.live");
		if (service && service.isEnabled()){
			service.getSystemValues(system_id, function (err, result){
				if (err){
					console.log("System %s load from snapshort err:%s.", system_id, err);
					reject(err);
				}

				resolve(result);
			})
		}
		else{
			reject("Service athena.live is NOT enabled!");
		}		
	})
};

SystemLiveHandler.prototype.takeSnapshot = function(system_id) {
	var self = this;
	return Q.Promise((resolve, reject) => {
		var service = self.services.get("athena.live");
		if (service && service.isEnabled()){
			var snap_data = self.the_system_.snapshort();
			if (!snap_data){
				return resolve();
			}

			// console.log("===== SNAPSHOT =====");
			// console.log(snap_data);

			service.setSystemValues(system_id, snap_data, function (err){
				if (err){
					console.log("System %s take snapshort err:%s.", system_id, err);
				}

				resolve();
			})
		}
		else{
			console.log("Service athena.live is NOT enabled!");
			resolve();
		}
	})
};

SystemLiveHandler.prototype.saveLog = function(system_id, timestamp) {
	var self = this;
	return Q.Promise((resolve, reject) => {
		var service = self.services.get("athena.log");
		if (service && service.isEnabled()){
			var his_data = self.the_system_.historic();
			if (!his_data){
				return resolve();
			}
		
			// console.log("===== HISTORIC =====")
			// console.log(his_data);			
						
			service.append(system_id, his_data, timestamp, function (err){
				if (err){
					console.log("System %s save log err:%s.", system_id, err);
				}

				resolve();
			});
		}
		else{
			console.log("Service athena.log is NOT enabled!");
			resolve();
		}
	})
};

SystemLiveHandler.prototype.writeSystemStatus = function(system_id, status) {
	var self = this;
	return Q.Promise((resolve, reject) => {
		var service = self.services.get("athena.live");
		if (service && service.isEnabled()){
			service.setSystemStatus(system_id, status, function (err){
				if (err){
					console.log("System %s write status err:%s.", system_id, err);
				}

				resolve();
			})
		}
		else{
			console.log("Service athena.live is NOT enabled!");
			resolve();
		}
	})
};

SystemLiveHandler.prototype.notify = function() {
	var self = this;
	return Q.Promise((resolve, reject) => {
		var notes = self.the_system_.notify();
		if (notes && notes.length){
			console.log("===== NOTIFY =====")
			console.dir(notes, {depth:5});	
		}

		resolve();
	});
};