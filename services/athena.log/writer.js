var EventEmitter = require('events').EventEmitter
	, LobsterClient = require('../../../common/lobster_client')
	, Topic = require('../../../common/topic')
	, moment = require('moment');

function Writer(options){
	EventEmitter.call(this);
	var me = this;

	options = options || {};

	var host_ = options.server || "http://localhost:8001";
	var max_queue_len_ = options.max_queue_len || 500;
	var max_data_count_ = options.max_data_count || 100 * max_queue_len_;
	var commit_cycle_ = options.time_to_push || 5 * 1000;

	var queue_ = [];
	var data_count_ = 0;
	var timer_ = null;

	var client_ = new LobsterClient({"host":[host_]});

	var calc_sum_ = function (queue){
		var count = 0;
		queue.forEach(function (it){
			count += Object.keys(it.data).length;
		});

		return count;
	}

	var commit_ = function (){
		var queue = queue_;
		if (!queue.length)
			return;

		queue_ = [];

		(function (){
			var start = Date.now();
			client_.append(queue, function (err, ret){
				var end = Date.now();

				console.log("[%s] Write records:%s, cost:%s ms, status:%s.",
					moment().format("YYYY-MM-DD HH:mm:ss"),
					calc_sum_(queue),
					(end - start),
					err ? (err.message ? err.message : err.code) : "OK");

			});			
		})();

	}

	/*
		@system_uuid - string,
		@data - object
		{
			"field_1_id" : "${field_1_value}",
			"field_2_id" : "${field_2_value}",
			"field_3_id" : "${field_3_value}",			
		}
		@timestamp - number
	*/
	this.append = function (system_uuid, data, timestamp){
		var metric_name = Topic.systemMetricName(system_uuid);

		queue_.push({
			"topic" : system_uuid,
			"metric" : metric_name,
			"data" : data,
			"ts" : timestamp
		});

		data_count_ += Object.keys(data).length;
		if (queue_.length >= max_queue_len_ || data_count_ >= max_data_count_){
			commit_();
			data_count_ = 0;
		}
	}

	this.run = function (){
		if (timer_)
			clearInterval(timer_);

		timer_ = setInterval(function(){
			commit_();
		}, commit_cycle_);
	}

	this.close = function (){
		if (timer_)
			clearInterval(timer_);
		me.removeAllListeners();
	}

	this.run();
}
require('util').inherits(Writer, EventEmitter);

module.exports = Writer;