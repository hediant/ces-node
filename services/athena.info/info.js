/*
 * infomation service wrapper class
 */

var BaseService = require('../../common/baseservice');
var Info = require('../../../model_info');
var InfoCache = Info.InfoCache;
var SystemWatcher = Info.SystemWatcher;

//
// 事件处理器基类
// folder - string, 该服务所在的绝对路径
//
function Information(folder, config){
	BaseService.call(this, folder, config, 'athena.info');

	var self = this;
	this.on('init', function(){
		self.init();
	});

	// 不要忘记响应关闭事件
	this.on('close', function(){
		self.close();
		this.removeAllListeners();
	});
};
require('util').inherits(Information, BaseService);
Information.prototype.constructor = Information;
module.exports=Information;

Information.prototype.init = function() {
	var self = this;
	this.config_.fetch_interval = this.config_.fetch_interval || 1000;

	// 需要公开访问的服务的方法在这里定义
	this.public_ = {
		'createSystemWatcher' : this.createSystemWatcher
	};

	if (!this.initDbServer())
		return;

	this.info_cache_ = new InfoCache(this.config_.fetch_interval);
	this.info_cache_.on('error', function(err){
		logger.error("UPDATE INFORMATION ERROR: %s", err.message);
	});

	// begin subcribe 
	this.info_cache_.sub();

	// 
	// NOTE:
	//		重载SystemWatcher的getInfoCache方法
	//		目的是自动响应info服务的重新载入，这个方法比在Watcher的instance中listen ‘ready’的方案性能高得多
	//
	SystemWatcher.prototype.getInfoCache = function(){
		return self.info_cache_;
	};

	// Do NOT forget
	this.emit('ready');

};

Information.prototype.initDbServer = function() {
	var self = this;
	if (!this.config_.server) {
		this.emit('error', "BAD_CONFIG_SETTINGS");
		return;
	}

	// create or reconnect
	var pool_ = Info.createDbConnection(this.config_.server);
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

Information.prototype.close = function() {
	var self = this;

	// close connection to db
	Info.closeDbConnection();
	logger.debug("service <%s> close connection to database.", self.name_);

	// close stations cache
	if (this.info_cache_) {
		this.info_cache_.unsub();
		this.info_cache_.close();
	}
};

//
// @system_id - string
// @cb - function(err, station) 如果主题存在返回object，否则返回null。
//
Information.prototype.createSystemWatcher = function(system_id) {
	var watcher = new SystemWatcher(this.info_cache_, system_id);
	return watcher;
};
