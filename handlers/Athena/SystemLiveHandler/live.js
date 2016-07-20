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

	// has loaded last values
	this.has_loaded_lastvalues_ = false;

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
		if (!sys_info || sys_info.state != 0){
			// system NOT exist or not active
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
			});
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
		var snap_data = self.the_system_.snapshort();
		if (snap_data){
			/*
			console.log("===== SNAPSHOT =====")
			console.log(self.the_system_.snapshort())
			*/
			yield self.takeSnapshot(system_id, snap_data);
		}

		// 将数据写到历史库中,如果有需要保存历史的数据
		var his_data = self.the_system_.historic();
		if (his_data){
			/*
			console.log("===== HISTORIC =====")
			console.log(self.the_system_.historic());			
			*/
			yield self.saveLog(system_id, his_data, ts);
		}

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

SystemLiveHandler.prototype.takeSnapshot = function(system_id, fields) {
	var self = this;
	return Q.Promise((resolve, reject) => {
		var service = self.services.get("athena.live");
		if (service && service.isEnabled()){
			service.setSystemValues(system_id, fields, function (err){
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

SystemLiveHandler.prototype.saveLog = function(system_id, fields, timestamp) {
	var self = this;
	return Q.Promise((resolve, reject) => {
		var service = self.services.get("athena.log");
		if (service && service.isEnabled()){
			service.append(system_id, fields, timestamp, function (err){
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

SystemLiveHandler.prototype.writeSystemStatus = function(system_id, status, cb) {
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