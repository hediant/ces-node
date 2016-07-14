var SequentialHandler = require('../../SequentialHandler')
	, SCW = require('../../../common/slidingwindow').SlidingCountWindow
	, Topics = require('../../../../common/topics')
	, obj_values = require('../../../../utils/obj_values')
	, async = require('async')
	, snapshot = require('./snapshot')
	, SaveLog = require('./savelog')
	, transform = require('./transform')
	, TriggerChecker = require('./triggerchecker')
	, SystemStatus = require('./status')
	, copy = require('copy-to')
	, type_cast = require('./type_cast')
	, quality_cast = require('./quality_cast')
	, valid_data = require('./valid_data');

function SystemLiveHandler (topic, broker) {
	var self = this;
	SequentialHandler.call(this, topic, broker);

	// Add your own initialize functions here
	this.on('message', this.handleEvent);

	// Close when handler destroy
	this.on('close', function(){
		self.removeAllListeners();
	});

	// create system watcher by system uuid
	this.createWatcher(topic);

	// 创建滑动时间窗口
	// COUNT = 2
	// 保持上2条记录，和当前事件记录，就可以实现旋转门算法
	this.scw_ = new SCW(topic, this.services, 2);

	// log saver, historian for logging data
	this.log_saver_ = new SaveLog(this);

	// system status
	this.system_status_ = new SystemStatus(this);

	// has loaded last values
	this.has_loaded_lastvalues_ = false;
};
require('util').inherits(SystemLiveHandler, SequentialHandler);
SystemLiveHandler.prototype.constructor = SystemLiveHandler;

module.exports = SystemLiveHandler;

SystemLiveHandler.prototype.createWatcher = function (topic) {
	var athena_info = this.services.get("athena.info");
	if (!athena_info || !athena_info.isEnabled())
		throw new Error("athena.info is not enabled");

	var system_id = Topics.systemUuid(topic);

	//
	// NOTE:
	//		if athena_info re-start, it will reset this watcher's
	//		cache connection automatically.
	//		we do NOT need listen 'ready' event of athena.info service.
	//
	var watcher = athena_info.createSystemWatcher(system_id);
	this.watcher_ = watcher;
};

SystemLiveHandler.prototype.handleEvent = function (topic, fields) {
	var self = this
		, services = this.services;

	if (!this.watcher_){
		this.createWatcher(topic);
	}

	var system_id = Topics.systemUuid(topic);
	this.watcher_.read(function(err, system){
		if (err) {
			console.error("read watch error:",err);
			self.nextEvent();
			return;
		}

		// is system actived ?
		if (!system || system.base.state !=1) {
			self.nextEvent();
			return;
		}

		//
		// construct valid fields
		// change idx from <tag_name> to <tag_id>
		//
		var valid_fields = validFields(system.base.tags, fields);
		if (!validFields){
			console.error("valid fields:",fields);
			self.nextEvent();
			return;
		}
		delete fields;

		// 序列执行
		async.waterfall([
			// STATUS
			function (callback){
				var status_ = {};
				// set online status
				if (fields.status){
					status_.online = fields.status.online;
				}

				self.system_status_.setStatus(system.base, status_, function(err){
					// ignore errors
					callback();
				});
			},

			// Load last values if need
			// 注意：
			//		这个初始化装载必须成功才能进行到下一步。
			//
			function (callback) {
				if (self.has_loaded_lastvalues_)
					return callback();

				var live_srv = services.get("athena.live");
				if (!live_srv || !live_srv.isEnabled()){
					console.error("service athena.live invalid on loading last values.")
					return callback("ER_LOAD_LASTVALUES");
				}

				// get all values
				var system_id = system.base.uuid;
				live_srv.getSystemValues(system_id, function (err, values){
					if (err){
						console.error("load system:%s lastvalues error. %s", system_id, err);
						callback(err);
					}
					else {
						// if system's snapshot not exist, we just return
                                                                                     // 会出现values={}，注意考虑到这种情况
						if(!values)
							callback();
						else {
							var tag_names = Object.keys(system.base.tags);
							tag_names.forEach(function (tag_name){
								var last = values[tag_name];
								if (last){
									var data = {};
									data[tag_name] = last.pv;

									// init sliding window
									self.scw_.slide(topic, data, last.rcv ? last.rcv : 0);
								}
							});

							self.has_loaded_lastvalues_ = true;
							//console.dir(self.scw_.getSeries(), {depth:10});
							callback();
						}
					}
				});

			},

			// 前置处理（变换）
			function (callback){
				transform(system.profile, valid_fields);
				callback();
			},

			// 处理内部变量

			// 处理逻辑（脚本）

			// 快照
			function (callback) {
				snapshot(services.get("athena.live"), system.base.tags, topic, valid_fields, callback);
			},

			// 保存历史
			function (callback) {
				// assert system exist
				self.log_saver_.insert(system.profile, topic, valid_fields, callback);
			},

			// 触发trigger
			function (callback) {
				var checker = new TriggerChecker(self, system);
				checker.checkTriggers(valid_fields, callback);
			},

			// 后处理
		], function (err){
			//
			// NOTE:
			// 不要忘记实现滑动
			//
			self.scw_.slide(topic, valid_fields.data, valid_fields.recv);

			// DO NEXT
			self.nextEvent();
		});
	});
};

var validFields = function (tags, fields){
	if (!fields || !fields.recv)
		return null;

	var valid_fields = {};
	copy(fields).to(valid_fields);

	// init data object
	valid_fields.data = {};
	valid_fields.quality = {};

	for (var tag_id in tags){
		var tag = tags[tag_id];

		if (!fields.data || !fields.data.hasOwnProperty(tag.name))
			continue;

		// if valid data type
		var val = type_cast(tag, fields.data);
		if (!valid_data(val))
			continue;
		else {
			//	set value
			valid_fields.data[tag_id] = val;

			// set quality
			if (fields.quality && fields.quality.hasOwnProperty(tag.name)){
				valid_fields.quality[tag_id] = quality_cast(fields.quality[tag.name]);
			}
		}
	}

	return valid_fields;
};
