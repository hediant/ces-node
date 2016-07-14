var valid_data = require('./valid_data');

//
// 当前的策略是：
//		1. fetch status per new data (or empty data)
//		2. set offline status while over 5 minutes (no new data)
//		3. delete status from snapshot cache while over 15 minutes (no new data)
//
function SystemStatus(handler, max_expire_time){
	this.handler_ = handler;

	this.current_status_ = {};
	this.online_times_ = 0;

	this.last_active_time_ = 0;

	// NOTE:
	// this.max_expire_time_ is diff to redis max expire time of key
	// it must little than half of the redis max expire time of key
	this.max_expire_time_ = max_expire_time || 15 * 60 * 1000; // 15 minutes
	this.ttl_ = this.max_expire_time_; // time to leave (persistent status to redis)

	this.timer_ = null;
};

module.exports = SystemStatus;

SystemStatus.prototype.getService = function() {
	return this.handler_.services.get("athena.live");
};

SystemStatus.prototype.setStatus = function(system, status, cb) {
	var self = this;
	var current = Date.now().valueOf();

	// if the system still online
	if (this.current_status_.online){
		this.online_times_ += (current - this.last_active_time_);
		this.ttl_ -= (current - this.last_active_time_);
		this.last_active_time_ = current;

		if (this.ttl_ > 0) {
			self.checkStatus(system);
			cb && cb(null);
			return;
		}
		else{
			this.ttl_ = this.max_expire_time_;
		}
	}
	else{
		this.last_active_time_ = current;
	}

	// set status && current_status
	this.current_status_.online = 1;
    this.current_status_.region_id = system.region_id;

	var service = this.getService();
	if (service && service.isEnabled()){
		service.setSystemStatus(system.uuid, self.current_status_, function(err){
			// NOTE:
			// 这里并不需要处理错误
			// 0、如果发生错误，会走到两个分支：
			// 1、下一个timeout校验点，如果超时会设置为offline，如果再错误，回到{0}阶段
			// 2、下一个数据或状态到达，重新进入setStatus阶段
			cb && cb(err);
		});
	}

	// set time out check point
	self.checkStatus(system);
};

SystemStatus.prototype.checkStatus = function(system) {
	var self = this;
	var ping_time = 300000;	// default to 5 minutes
	if (system.ping_time)
		ping_time = system.ping_time * 1000;

	if (this.timer_)
		clearTimeout(this.timer_);

	this.timer_ = setTimeout(function(){
		// set offline && current_status
		self.current_status_.online = 0;
		self.ttl_ = self.max_expire_time_;
		self.online_times_ = 0;

		var service = self.getService();
		if (service && service.isEnabled()){
			service.setSystemStatus(system.uuid, self.current_status_, function(err){
				if (err){
					self.checkStatus(system);
				}
			});
		}
		else{ // if service invaild
			self.checkStatus(system);
		}
	}, ping_time);

};

SystemStatus.prototype.getStatus = function() {
	return this.current_status_;
};
