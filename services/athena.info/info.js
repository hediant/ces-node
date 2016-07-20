/*
 * infomation service wrapper class
 */

var BaseService = require('../../common/baseservice')
	, SystemCache = require('../../../common/system').SystemCache
	, mysql = require('mysql')
	, SimpleOrm = require("../../../common/simpleorm")
	, DbHelper = SimpleOrm.DbHelper;

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
		'readSystem' : this.readSystem
	};

	this.pool_ = mysql.createPool(this.config_.server);
	this.dbhelper_ = new DbHelper(this.pool_);
	this.system_cache_ = new SystemCache(this.dbhelper_, this.config_.fetch_interval);

	// Do NOT forget
	this.emit('ready');

};

Information.prototype.close = function() {
	var self = this;
	logger.debug("service <%s> close connection to database.", self.name_);

	// close mysql pool
	if (this.pool_){
		this.pool_.end();
	}

	// close system cache
	if (this.system_cache_) {
		this.system_cache_.close();
	}
};

//
// @system_uuid - string
// @cb - function(err, station) 如果主题存在返回object，否则返回null。
//
Information.prototype.readSystem = function(system_uuid, cb) {
	var self = this;
/*
	setImmediate(function (){
		cb(null, {
			"uuid" : system_uuid,
			"name" : "${system name}",
			"desc" : "${system description}",
			"state" : 1,
			"model" : "${thing model uuid}",
			"ping_time":300,	
			"status" : 0,
			"version" : 0,

			"superview" : {
				"fields" : [
					{
						"id" : "abc",
						"name" : "tag_1",
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
					},
					{
						"id" : "abd",
						"name" : "tag_2",
						"display_name" : "全球化字符串",
						"type" : "NUMBER",
						"default" : 0,
						"connect" : "DEV_1.AI_1",
						"fixed" : 2,
						"meta" : null,
						"unit" : "工程单位，最大8个字符",
						"scale" : 1.0,
						"deviation" : 0.0,
						"save_log" : true,
						"log_cycle" : 300,
						"log_type" : "changed",
						"log_params" : null			
					}
				],
				"triggers" : [
					{
						"name" : "trigger_1",
						"type" : "Once",
						"topic" : "Alarm || Message Topic",
						"conditions" : "conditions json",
						"params" : "params json",
						"origin" : "Cloud"
					}
				]
			}
		})
	});
*/
	this.system_cache_.get(system_uuid, function (err, result){
		cb && cb(err, result);
	});

};
