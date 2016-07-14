/*
 * infomation service wrapper class
 */

var BaseService = require('../../common/baseservice');

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

	// Do NOT forget
	this.emit('ready');

};

Information.prototype.close = function() {
	var self = this;
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
	return {
		"getSystem" : function (){
			return {
				"uuid" : system_id,
				"name" : "${system name}",
				"desc" : "${system description}",
				"state" : 0,
				"model" : "${thing model uuid}",
				"ping_time":300000,	
				"status" : 0,
				"version" : 0,

				"superview" : {
					"fields" : [
						{
							"id" : "abc",
							"name" : "tag_1",
							"display_name" : "全球化字符串",
							"type" : "Analog",
							"default" : 0,
							"connect" : "DEV_1.AI_0",
							"fixed" : 2,
							"meta" : null,
							"unit" : "工程单位，最大8个字符",
							"scale" : 1.0,
							"deviation" : 0.0,
							"save_log" : true,
							"log_cycle" : 300000,
							"log_type" : "Period",
							"log_params" : null
						},
						{
							"id" : "abd",
							"name" : "tag_2",
							"display_name" : "全球化字符串",
							"type" : "Digital",
							"default" : 0,
							"connect" : "DEV_1.AI_1",
							"fixed" : 2,
							"meta" : null,
							"unit" : "工程单位，最大8个字符",
							"scale" : 1.0,
							"deviation" : 0.0,
							"save_log" : true,
							"log_cycle" : 300000,
							"log_type" : "Changed",
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
			}
		}
	}
};
