var Topics = require('../../../../common/topics')
	, obj_values = require('../../../../utils/obj_values')
	, async = require('async')
	, SaveAlarm = require('./savealarm')
	, valid_data = require('./valid_data');

function TriggerChecker(handler, system) {
	//this.handler_ = handler;
	this.system_ = system;
	this.alarm_saver_ = new SaveAlarm(handler);
}

TriggerChecker.prototype.checkTriggers = function(fields, cb) {
	var triggers = this.system_.triggers;
	if (!triggers){
		cb (null);
	}
	else{
		cb(this.doCheck(triggers, fields));
	}
}

TriggerChecker.prototype.doCheck = function(triggers, fields) {
	var self = this;
	var datasource = self.dataSource(fields);
	if (!datasource)
		return;

	for (var id in triggers){
		try {
			var trigger = triggers[id];
			self.doTriggerAction(trigger, datasource);
		}
		catch(err){
			console.error("check and do trigger %s error: %.", trigger.id, err.message);
		}
	}
}

TriggerChecker.prototype.dataSource = function (fields) {
	var self = this, scws = {}, live = {}, last = {}; // series of sliding count windows

	var tags = this.system_.base.tags;
	if (!tags){
		return null;
	}

	for (var tag_id in tags){
		var tag = tags[tag_id];

		// set past values
		var the_scws = self.alarm_saver_.handler_.scw_.getSeries(tag.id);
		scws[tag.name] = the_scws;

		// get last pv
		//var the_series = the_scws.series;
		//var last_val = the_series[the_series.length-1];
		//last[tag.name] = valid_data(last_val) ? last_val : null;
		var last_val;
		the_scws ? (last_val = the_scws[the_scws.length-1]["v"]) : (last_val = null);
		last[tag.name] = valid_data(last_val) ? last_val : null;

		// set current val
		var val = fields.data[tag.id];
		if (typeof val != "undefined"){
			live[tag.name] = val;
		}
		else{
			// get last value for current value
			live[tag.name] = valid_data(last_val) ? last_val : null;
		}
	};

	// return datasource
	var ds = {
		live : live,	// realtime data
		scws : scws,	// series of sliding count windows
		last : last		// last values
	};

	return ds;
};

TriggerChecker.prototype.doTriggerAction = function(trigger, datasource) {
	// if the alarm was triggered in the remote gateway or NOT in the ThingLinx Cloud.
	if (trigger.origin != 0)
		return;
	// check if match the trigger rules
	var is_match = (trigger && trigger.doCheck(datasource));
	if (!is_match){
		return;
	}

	var self = this;
	//emit alarm
	switch(trigger.action) {
		case "alarm":
			{
				self.alarm_saver_.saveAlarmInfo(this.system_, trigger, datasource);
			}
			break;
		default:
			// do nothing
			break;
	}
}

module.exports = TriggerChecker;