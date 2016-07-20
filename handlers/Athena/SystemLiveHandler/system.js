var EventEmitter = require('events').EventEmitter
	, Attribute = require('./attribute');

/*
	@info - object
	{
	    "uuid" : "${system uuid}",
	    "name" : "${system name}",
	    "desc" : "${system description}",
	    "state" : 0,
	    "model" : "${thing model uuid}",
	    "ping_time":300000, 
	    "status" : 0,
	    "create_time" : "",
	    "last_modify_time" : "",
	    "version" : 0,

	    "superview" : {
	        "fields" : [
	            {
	                "id" : "abc",
	                "name" : "field_name_1",
	                "display_name" : "全球化字符串",
	                "type" : "Analog",
	                "default" : 0,
	                "connect" : "DEV_1.AI_0",
	                "fixed" : 2,
	                "meta" : null,
	                "unit" : "工程单位，最大8个字符",
	                "scale" : 1.0,
	                "deviation" : 0.0,
	                "save_log" : true,
	                "log_cycle" : 300000,
	                "log_type" : "Period",
	                "log_params" : null
	            },
	            ... ...
	        ],
	        "triggers" : [
	            {
	                "name" : "trigger_1",
	                "type" : "Once",
	                "topic" : "Alarm || Message Topic",
	                "conditions" : "conditions json",
	                "params" : "params json",
	                "origin" : "Cloud"
	            }
	        ]
	    }
	}	
*/
function System(info, handler){
	EventEmitter.call(this);

	var fields_ = {};

	var snapshot_ = {};
	var historic_ = {};
	var status_ = {	"online" : 0, "ts" : 0 };
	var timer_;
	// 1 hour
	var time_to_save_ = 1 *60 * 60 * 1000;

	this.assign = function (info){
		this.uuid = info.uuid;
		this.name = info.name;
		this.state = info.state;
		this.version = info.version;
		this.ping_time = info.ping_time || 300000;

		// set attributes		
		if (info && info.superview){
			info.superview.fields.forEach(function (field){
				fields_[field.name] = new Attribute(field);
			});
		}
	}

	this.reset = function (){
		snapshot_ = {}, historic_ = {};
	}

	this.release = function (){
		this.reset();
		if (timer_)
			clearTimeout(timer_);

		this.removeAllListeners();		
	}

	this.getAttribute = function (field_name){
		return fields_[field_name];
	}

	this.setValue = function (field_name, value, timestamp){
		var attr = this.getAttribute(field_name);
		if (!attr)
			return ;

		// set value and timestamp
		attr.setPair(value, timestamp);

		//
		// NOTE:
		//    将snapshot和historic的逻辑放在setValue里, 主要是基于性能方面的考虑
		//    这样我们可以避免多次对fields的遍历
		//

		// set snapshot
		if (attr.hasNewValue())
			snapshot_[attr.id] = attr.getPair();

		// set historic
		if (attr.needSave()){
			historic_[attr.id] = attr.getValue();
			attr.setLastSave(timestamp);
		}

		// reset to receive new data
		attr.reset();
	}

	this.getValue = function (field_name){
		var attr = this.getAttribute(field_name);
		return attr ? attr.getValue() : undefined;
	}

	this.snapshort = function (){
		if (Object.keys(snapshot_).length)
			return snapshot_;
		else
			return null;
	}

	this.historic = function (){
		if (Object.keys(historic_).length)
			return historic_;
		else
			return null;
	}

	this.hasSatusChanged = function (status){
		return status_.online != status.online; 
	}

	this.fetchStatus = function (status){
		var now = Date.now();
		if (this.hasSatusChanged(status)){
			status_.online = status.online;
			status_.ts = now;			
			
			this.emit("status", status_);
			this.checkStatus();
		}
		else{
			if (now - status_.ts >= this.time_to_save_){
				status_.ts = now;
				this.emit("status", status_);
			}
		}
	}

	this.checkStatus = function (){
		var self = this;
		var timeout = !isNaN(this.ping_time) && this.ping_time > 60 ? (this.ping_time * 1000) : (300 * 1000);
		if (timer_)
			clearTimeout(timer_);

		timer_ = setTimeout(function (){
			self.fetchStatus({online:0});
		}, timeout);
	}

	this.notify = function (){
		return [];
	}

	this.assign(info);
}
require('util').inherits(System, EventEmitter);
System.prototype.constructor = System;

module.exports = System;