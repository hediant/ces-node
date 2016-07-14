/*
 * alarm service wrapper class
 */

var BaseService = require('../../common/baseservice');
var alarm = require('../../../alarm');

//
// 事件处理器基类
// folder - string, 该服务所在的绝对路径
//
function AlarmServ(folder, config){
	BaseService.call(this, folder, config, 'athena.alarm');

	var self = this;
	this.on('init', function(){
		self.init();
	});

	// 不要忘记响应关闭事件
	this.on('close', function(){
		self.close();
		this.removeAllListeners();
	});
	this.daily_limits_;
};

require('util').inherits(AlarmServ, BaseService);
AlarmServ.prototype.constructor = AlarmServ;
module.exports=AlarmServ;

AlarmServ.prototype.init = function() {
	var self = this;

	// 需要公开访问的服务的方法在这里定义
	this.public_ = {
		'newAlarm' : this.newAlarm,
		'clearAlarm' : this.clearAlarm
	};

	if (!this.initDbServer())
		return;

	// Do NOT forget
	this.emit('ready');

};

AlarmServ.prototype.initDbServer = function() {
	var self = this;
	if (!this.config_.server) {
		this.emit('error', "BAD_CONFIG_SETTINGS");
		return;
	}

	// create or reconnect
	var pool_ = alarm.createDbConnection(this.config_.server);
	pool_.on('connect', function(){
		logger.debug("service <%s> connect to database, %s.", this.name_, JSON.stringify(this.config_.server));
	});

	pool_.on('error', function(err){
		logger.error("server <%s> error: %s", this.name_, err.message);

		// re-connect ?
		pool_.end();
		self.initDbServer();
	});

	// return
	return true;
};

AlarmServ.prototype.close = function() {
	var self = this;

	// close connection to db
	var pool_ = alarm.getConnectionPool();
	if (pool_) {
		logger.debug("service <%s> close connection to database.", self.name_);
		pool_.end();
	}
};

//
// alarm_obj - object
//		source : {
//			account_id:number,
//			[project_id]:number,
//			[station_id]:number,
//			device_id:number
//		}
// 		fields : {
//			trigger_id : number,
//			[class_id] : number,
//			[info] : string,
//			[severity] : number [0-5],
//		}
// cb - function(err, alarm_id)
// 		如果成功返回err==null和alarm_id
//		如果失败返回err == TOO_MANY_SOURCES || SPACE_NOT_EXIST || ER_*
//
AlarmServ.prototype.newAlarm = function(message_serv,alarm_obj, cb) {
	alarm.alarms.createAlarm(message_serv, alarm_obj, cb);
};

//
// trigger_id - number,
//		注意：
//		这个trigger_id指的是触发报警（occur_trigger）的id，而不是指当前clear alarm的触发器
// source_obj - object
// {
//		account_id : number,
//		device_id : number
// }
// cb - function(err)
// 		如果成功返回err==null
//		如果失败返回err==ALARM_NOT_EXIST || TOO_MANY_SOURCES || SPACE_NOT_EXIST || ER_*
//
AlarmServ.prototype.clearAlarm = function(trigger_id, source_obj, cb) {
	alarm.alarms.clearAlarmState(trigger_id, source_obj, cb);
};

AlarmServ.prototype.loadLimits = function () {

}