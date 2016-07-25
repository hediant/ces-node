//
// 滑动时间窗口类
//
var SlidingWindow = require('./slidingwindow');

function SlidingTimeWindow(topic, period){
	// base
	SlidingWindow.call(this, topic);
	this.period_ = period || 5000;	// 默认是5000毫秒

	// init
	this.init();

	// total time series
	// 需要一个全局的时间序列的原因是，各key的时间长短不一，为了保证统一的时间窗口滑动
	this.times_ = [];	
};
require('util').inherits(SlidingTimeWindow, SlidingWindow);
SlidingTimeWindow.prototype.constructor = SlidingTimeWindow;
module.exports = SlidingTimeWindow;

SlidingTimeWindow.prototype.init = function() {
	this.ready_ = true;
};

// 
// 滑动时间窗口(从父类继承)
//
SlidingTimeWindow.prototype.slide = function(topic, fields, timestamp) {
	if (!fields)
		return;
	this.slidingTime_(fields, this.period_, timestamp);
};

// 
// 滑动时间窗口
//
SlidingTimeWindow.prototype.slidingTime_ = function(fields, period, timestamp) {
	var curr_ = Date.now()
		, start_ = curr_ - period
		, timestamp_ = isNaN(timestamp) ? curr_ : timestamp
		, times = this.times_;

	if (timestamp_ < start_)
		return;
	
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

		while(theSeries[0] && theSeries[0].t < start_){
			theSeries.shift();
		}
	}
};