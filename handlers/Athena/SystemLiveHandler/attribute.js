var typeCast = require('./type_cast');

function Attribute (info){
	this.assign(info);

	this.series_ = [];
	this.changed_ = false;
	this.new_ = false;
	this.last_save_ = 0;
	this.value_ = undefined;
	this.slidingCount_ = 3;
}

/*
	@info - object
    {
        "id" : "abc",
        "name" : "field_name_1",
        "display_name" : "全球化字符串",
        "type" : "NUMBER",
        "default" : 0,
        "connect" : "DEV_1.AI_0",
        "fixed" : 2,
        "meta" : null,
        "unit" : "工程单位，最大8个字符",
        "scale" : 1.0,
        "deviation" : 0.0,
        "save_log" : true,
        "log_cycle" : 300,
        "log_type" : "period",
        "log_params" : null
    }	
*/
Attribute.prototype.assign = function(info) {
	for (var key in info){
		this[key] = info[key];
	}
};

Attribute.prototype.getSeries = function () {
	return this.series_;
};

Attribute.prototype.setPair = function (value, timestamp) {
	this.series_.push({
		"val" : this.transform(value),
		"ts" : timestamp
	});

	if (this.series_.length > this.slidingCount_){
		this.series_.shift();
	}

	if (this.value_ !== value)
		this.changed_ = true;

	this.value_ = value;
	this.new_ = true;
};

Attribute.prototype.transform = function(value) {
	var val = typeCast(value, this.type);
	if (this.type != "NUMBER" ||
		isNaN(this.scale) ||
		isNaN(this.deviation))
		return val;

	return val * this.scale + this.deviation;
};

Attribute.prototype.getValue = function() {
	return this.value_;
};

Attribute.prototype.getPair = function() {
	return this.series_[this.series_.length - 1];
};

Attribute.prototype.getLastPair = function() {
	return this.series_[this.series_.length - 1];
};

Attribute.prototype.reset = function() {
	this.new_ = false;
	this.changed_ = false;
};

Attribute.prototype.hasChanged = function() {
	return this.new_ && this.changed_;
};

Attribute.prototype.hasNewValue = function() {
	return this.new_;
};

Attribute.prototype.setLastSave = function(timestamp) {
	this.last_save_ = timestamp;
};

Attribute.prototype.needSave = function() {
	if (!this.save_log)
		return false;

	switch(this.log_type){
		case "raw":
			if (this.hasNewValue())
				return true;
		case "period":
			if (this.hasNewValue()){
				// default to 300 secs
				var cycle = parseInt(this.log_cycle);
				var cycle = cycle && cycle >= 60 ? cycle : 300;
				var pair = this.getPair();
				var duration = pair.ts - this.last_save_;

				return duration >= cycle * 1000;
			}
			else{
				return false;
			}
		case "changed":
			return this.hasChanged();
		default:
			return false;
	}
};

module.exports = Attribute;