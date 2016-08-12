/*
 * sliding time window
 */

var EventEmitter = require('events').EventEmitter
	, recv_time = "recv"
	, source_time = "source";

function SlidingWindow(topic){
	EventEmitter.call(this);

	//
	// 滑动时间窗口会尝试从eventstream服务加载时间窗口范围内的历史事件记录
	// 该标志用于标注是否已经完成历史事件记录的加载。
	// 事件处理器Handler需要自己根据是否加载完成的标记来判断是否使用滑动时间窗口中的事件记录。
	//
	// NOTE:
	// 		暂时没有实现，先保留
	//
	this.ready_ = false;
	this.topic_ = topic;

	//
	// key - string
	// value - array
	/*
		[
			{
				"t" : timestamp, number
				"v" : object
			},
			... 
		]
	*/ 
	//
	this.fields_ = {};

}
require('util').inherits(SlidingWindow, EventEmitter);
module.exports = SlidingWindow;
SlidingWindow.prototype.constructor = SlidingWindow;

SlidingWindow.prototype.isReady = function(){
	return this.ready_;
};

//
// 执行一次滑动动作
// @topic - event topic, string
// @fields - {key, value} pairs, object
// [@timestamp] - 想对于1970年的毫秒数, default to current time
//
SlidingWindow.prototype.slide = function(topic, fields, timestamp){
	throw new TypeError('SlidingWindow is an abrtract class.');
};

SlidingWindow.prototype.getSeries = function(key){
	var key = arguments[0];
	if (key){
		return this.fields_[key];
	}
	else{
		return this.fields_;
	}
};




