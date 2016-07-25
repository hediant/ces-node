/*
 * historian service wrapper class
 */

var BaseService = require('../../common/baseservice');
var Writer = require('./writer');

//
// 事件处理器基类
// folder - string, 该服务所在的绝对路径
//
function HistorianLog(folder, config){
	BaseService.call(this, folder, config, 'athena.log');

	var self = this;
	this.on('init', function(){
		self.init();
	});

	// 不要忘记响应关闭事件
	this.on('close', function(){
		self.close();
	});
};
require('util').inherits(HistorianLog, BaseService);
HistorianLog.prototype.constructor = HistorianLog;
module.exports=HistorianLog;

HistorianLog.prototype.init = function() {
	var self = this;

	if (!this.initDbServer())
		return;

	// 需要公开访问的服务的方法在这里定义
	this.public_ = {
		'append' : this.append
	};

	// Do NOT forget
	this.emit('ready');

};

HistorianLog.prototype.initDbServer = function() {
	if (!this.config_.server) {
		this.emit('error', "BAD_CONFIG_SETTINGS");
		return;
	}

	// create or reconnect
	logger.debug("service <%s> connect to database, %s.", this.name_, this.config_.server);
	this.service_ = new Writer(this.config_);

	// return
	return true;
};

HistorianLog.prototype.close = function() {
	// close connection to db
	this.service_ && this.service_.close();
	this.removeAllListeners();
};

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
HistorianLog.prototype.append = function(system_uuid, data, timestamp, cb) {
	this.service_.append(system_uuid, data, timestamp);
	cb && cb();
};