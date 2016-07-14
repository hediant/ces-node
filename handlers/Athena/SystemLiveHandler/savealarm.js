var async = require('async');
function SaveAlarm(handler) {
	this.handler_ = handler;
};

module.exports = SaveAlarm;

SaveAlarm.prototype.getService = function(name) {
	return this.handler_.services.get(name);
};



SaveAlarm.prototype.saveAlarmInfo = function(systemInfo, trigger, datasource) {
	var alarm_serv = this.getService("athena.alarm");
	var accessLimit_serv = this.getService("accesslimit");
    var messages_serv = this.getService("messages");
	if (!alarm_serv || !accessLimit_serv || !messages_serv)
		return cb("ER_NO_SERVICE");

	var self = this;
	var alarm_info = buildAlarmObj(systemInfo, trigger, datasource);
	var limit = accessLimit_serv.getAccountLimit(alarm_info.source.account_id);
	alarm_info.daily_alarms = limit.daily_alarms;
    alarm_info.impend_daily_alarms = limit.impend_daily_alarms;
	alarm_serv.newAlarm(messages_serv, alarm_info, function(err, alarm_id){
		// debugging
		if (err){
			console.log("Write alarms error:%s, system:%s.", err.toString(), systemInfo.base.uuid);
			//logger.debug("Write alarms error:%s, system:%s.", err.toString(), self.system_.base.uuid);
		}
		else {
			/*
			console.log("--------------------------------------------");
			console.log("SYSTEM:%s", self.system_.base.uuid);
			console.log("NEW ALARM, err:%s, id:%s", err, alarm_id);
			console.log("Time : %s", Date())
			console.log(alarm_info);
			*/

			alarm_info.alarm_id = alarm_id;

			// send notice message back-end
			self.sendAlarmNotice(messages_serv, alarm_info);
		}
	});
};



SaveAlarm.prototype.sendAlarmNotice = function (messages_serv, alarm_info) {
	if (!(messages_serv.isEnabled()))
		return;

	var source = alarm_info.source;
	var filter = {
		account_id : source.account_id,
		region_id : source.region_id,
		system_id : source.system_id,
		type :  "alarm"
	};

	messages_serv.dispatch(filter, function (err, sendees){
		console.log("sendees:",sendees);
		if (err){
			console.log("dispatch error:%s, system:%s.", err.toString(), source.system_id);
		}
		if (!err && sendees.length){
			messages_serv.publish(alarm_info, sendees);
		}
	});
};

function buildAlarmObj(systemInfo, trigger, datasource){
	var params = trigger.params;
	var source = {
		account_id : systemInfo.base.account_id,
		system_id : systemInfo.base.uuid,
		system_name : systemInfo.base.name,
		region_id : systemInfo.base.region_id
	};

	var fields = {
		trigger_id : trigger.id,
		class_id : params.class_id,
		severity : params.severity,
		desc:params.desc
	};

	// construct alarm info
	if (params.tags && Array.isArray(params.tags)){
		var info = {};
		params.tags.forEach(function(tag_name){
			var pv_ = datasource.live[tag_name];
			var past_ = datasource.scws[tag_name];
			//驱动
			info[tag_name] = {
				//"from" : past_ ? past_.series[past_.series.length - 1] : null,
				"from" : past_ ? past_[past_.length - 1]["v"] : null,
				"to" : pv_
				//"limit" : params.limit
			}
		});

		fields.info = JSON.stringify(info);
	}

	var alarm_obj = { "source" : source, "fields" : fields };
	return alarm_obj;
};

