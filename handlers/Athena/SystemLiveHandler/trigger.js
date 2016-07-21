var TriggerConditions = require('./conditions');

function Trigger(system, trigger_info) {
	this.system_ = system;
	this.assign(trigger_info);

	// clear 
	this.reset();
}
module.exports = Trigger;

Trigger.prototype.assign = function(trigger_info) {
	this.name = trigger_info.name;
	this.topic = trigger_info.topic;

	this.origin = trigger_info.origin || "cloud";
	this.type = trigger_info.type || "once";

	this.conditions = new TriggerConditions();
	this.conditions.parse(trigger_info.conditions);

	this.params = trigger_info.params || {};
};

////////////////////////////////////////////////////////
// Member functions

Trigger.prototype.reset = function() {
	this.state_ = 0; // 0表示当前触发器状态复位（还没有被触发）
};

Trigger.prototype.set = function() {
	this.state_ = 1; // 1表示当前触发器已经被触发了
};

Trigger.prototype.getState = function() {
	return this.state_;
};

Trigger.prototype.doCheck = function() {
	var self = this, ret = false;

	// 如果不是在服务端运行
	if (this.origin != "cloud")
		return ret;

	var checked = this.conditions.match(this.system_.getDatasource());
	if (checked) {
		// 如果触发且仅触发一次, 并且当前状态为已触发
		if (this.type == "once" && this.getState())
			ret = false;
		else {
			// 设置状态为"已触发"
			this.set();
			ret = true;
		}
	}
	else{
		// 清除"已触发"状态
		this.reset();
	}	

	return ret;
};
