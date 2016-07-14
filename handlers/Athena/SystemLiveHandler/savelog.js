var valid_data = require('./valid_data');

function SaveLog(handler) {
	this.handler_ = handler;

	// last save log time
	this.last_save_times_ = {}; // key by tag_id
};
module.exports = SaveLog;

SaveLog.prototype.getService = function() {
	return this.handler_.services.get("athena.log");
};

SaveLog.prototype.insert = function (profile, topic, fields, cb) {
	var self = this
		, service = this.getService();

	// if profile not exist, system will not save log
	// we just return
	if (!profile || !profile.tags){
		cb && cb (null);
		return;
	}

	if (!service || !service.isEnabled()){
		// 如果log服务不可用，是应该继续后面的处理流程（如触发报警等）
		// 还是应该返回error，终止EventHandler呢？
		// 当前的做法是继续后面的处理流程。
		cb && cb (null);
		return;
	}

	// get current time tick
	var current = (new Date()).valueOf();

	var data = [];
	for (var tag_id in profile.tags){
		var tag = profile.tags[tag_id];
		var val = fields.data[tag_id];

		if (valid_data(val)){
			// if we need save this tag's log
			if (self.needSave(tag, current, val)){
				data.push(fillLogRecord(tag, val, fields));
			}
		}
	}

	if (data.length) {
		// insert into historian
		service.insert(topic, data, function(err){
			if (err){
				console.log("Save log error, topic:%s, error:%s", topic, err);
				//logger.debug("Save log error, topic:%s, error:%s", topic, err);
			}

			// MUST CALLBACK
			cb && cb (null);
		});
	}
	else{
		// MUST CALLBACK
		cb && cb (null);
	}
};

SaveLog.prototype.needSave = function(tag, current, val) {
	if (!tag || !tag.save_log)
		return false;

	switch(tag.log_type){
		case "RAW":
			return this.needSaveRaw(tag, current);
		case "CHANGED":
			return this.needSaveChanged(tag, val);
		default:
			return false;
	}
};

SaveLog.prototype.needSaveRaw = function(tag, current) {
	var last_save_time_ = this.last_save_times_[tag.id] || 0;
	var cycle_ = tag.log_cycle ? tag.log_cycle * 1000 : 300000;		// default to 300 secs

	if ((current - last_save_time_) >= cycle_){
		// DO NOT FORGET SET LAST SAVE TIME
		this.last_save_times_[tag.id] = current;
		return true;
	}
	else
		return false;
};

SaveLog.prototype.needSaveChanged = function(tag, val) {
	var scws = this.handler_.scw_.getSeries(tag.id);
/*
	if (!scws)
		return true;


	var series = scws.series;
	if (!series || !series.length)
		return true;
*/
	if (!scws || !scws.length )
		return true;
	var last_val;
	scws ? (last_val = scws[scws.length-1]["v"]) : (last_val = null);

	//var last_value = series[series.length-1];
	//return last_value === val ? false : true;
	return last_val === val ? false : true;
};

SaveLog.prototype.setLastSaveTime = function(data, current) {
	var self = this;
	data.forEach(function(rcd){
		self.last_save_times_[rcd.id] = current;
	});
};

function parseQuality(quality) {
	if (quality === "GOOD")
		return 1; // GOOD QUALITY
	else
		return -1; // BAD QUALITY
}

function fillLogRecord (tag, val, fields) {
	var rcd = {
		id : tag.id,			// tag id
		pv : val,				// value
		rcv : fields.recv,		// recv timestamp
		src : fields.source		// source timestamp
	};

	if (fields.quality ) {
		var vq = fields.quality[tag.id];
		if (vq)
			rcd.qly = parseQuality(vq);
	}

	return rcd;
}