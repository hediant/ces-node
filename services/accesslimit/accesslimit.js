/*
 * access limit service wrapper class
 * 之所以单独作为一个服务，考虑到以下几点
 * 1.其他模块需要限制参数时，在内存中只有一份，均可调用
 * 2.alarm 服务的数据库连接和限制不在一个数据库，
 *   做在一个服务中显得比较混乱，不便于代码维护的管理
 * 3.为了以后触发重新加载方便
 */

var BaseService = require('../../common/baseservice');
var account = require('../../../account');

//
// 事件处理器基类
// folder - string, 该服务所在的绝对路径
//
function AccessLimitServ(folder, config){
	BaseService.call(this, folder, config, 'accesslimit');

	var self = this;
	this.on('init', function(){
		self.init();
	});

	// 不要忘记响应关闭事件
	this.on('close', function(){
		self.close();
		this.removeAllListeners();
	});
	this.limits_ = {};
};

require('util').inherits(AccessLimitServ, BaseService);
AccessLimitServ.prototype.constructor = AccessLimitServ;
module.exports=AccessLimitServ;

AccessLimitServ.prototype.init = function() {
	var self = this;

	// 需要公开访问的服务的方法在这里定义
	this.public_ = {
		'getAccountLimit' : this.getAccountLimit
	};

	if (!this.initDbServer())
		return;
	this.loadLimits(function(err){
		if (err){
			return;
		}
		self.emit('ready');
	});
};

AccessLimitServ.prototype.initDbServer = function() {
	var self = this;
	if (!this.config_.server) {
		this.emit('error', "BAD_CONFIG_SETTINGS");
		return;
	}

	// create or reconnect
	var pool_ = account.createDbConnection(this.config_.server);
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

AccessLimitServ.prototype.close = function() {
	var self = this;

	// close connection to db
	var pool_ = account.getConnectionPool();
	if (pool_) {
		logger.debug("service <%s> close connection to database.", self.name_);
		pool_.end();
	}
};

//目前支持最多加载1000个account的限制
//为了减少内存的占用，目前只加载报警限制
AccessLimitServ.prototype.loadLimits = function (cb) {
	var options = {
		"limit" : 1000
	};
	var self = this;
	account.AccessLimit.find_({}, options, function(err, results){
		if (err){
			console.error("service <%s> load access limits error:%s.", self.name_,err);
		}
		else{
			results.forEach(function(limit){
				var account_id = limit.account_id;
				self.limits_[account_id] = {
                    daily_alarms : limit['daily_alarms'],
                    impend_daily_alarms : limit['impend_daily_alarms']
                };

			});
		}
		cb(err);
	});
}

//当未加载这个account的限制时，使用默认值
AccessLimitServ.prototype.getAccountLimit = function (account_id){

	var account_limit = this.limits_[account_id];
	if (!account_limit){
		logger.info("this account: <%s> limits not found,we will use default.", account_id);
		account_limit = {
			"daily_alarms" : 1000,
			"impend_daily_alarms" : 900
		};
	}
    return account_limit;
}