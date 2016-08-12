//
// 滑动时间窗口类
//
var SlidingWindow = require('./slidingwindow');

function SlidingCountWindow(topic, count){
	// base
	SlidingWindow.call(this, topic);
	this.count_ = count || 3;	// 默认是3个值

	// init
	this.init();
};
require('util').inherits(SlidingCountWindow, SlidingWindow);
SlidingCountWindow.prototype.constructor = SlidingCountWindow;
module.exports = SlidingCountWindow;

SlidingCountWindow.prototype.init = function() {
	this.ready_ = true;
};

// 
// 滑动计数器窗口(从父类继承)
//
SlidingCountWindow.prototype.slide = function(topic, fields, timestamp) {
	if (!fields)
		return;
	this.slidingCount_(fields, this.count_, timestamp);
};

//
// 滑动计数器窗口
//
SlidingCountWindow.prototype.slidingCount_ = function(fields, count, timestamp) {
	var self = this;
	var timestamp_ = isNaN(timestamp) ? Date.now() : timestamp;

	for(var key in fields){
		var theSeries = this.fields_[key];
		if (!theSeries){
			theSeries = [{
				"t" : timestamp_,
				"v" : fields[key]
			}];
			this.fields_[key] = theSeries;
			continue;
		}

		theSeries.push({
			"t" : timestamp_,
			"v" : fields[key]
		});

		theSeries.sort(function (a, b){ // positive sort by timestamp
			return a.t - b.t;
		});

		if (theSeries.length > self.count_){
			theSeries.shift();
		}
	}
};
