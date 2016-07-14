/*
 * Application Entry-point
 */

var EventEmitter = require('events').EventEmitter
	, AppConfig = require('./appconfig')
	, ServMgr = require('./servicesmgr')
	, Applier = require('./applier')
	, Receiver = require('./recv')
	, Sender = require('./sender')
	, EventBroker = require('./broker')
	, path = require('path');

// 初始化日志记录
require('../utils/logger')
    .use(require('../appconfig/log4js-default'), 'ces');

function App(){
	EventEmitter.call(this);

	root = 'ces/';
	// default app config path
	this.app_config_path_ = path.join(root, 'appconfig/app.json');
	// default services path
	this.services_path_ = path.join(root, 'services');
	// default handlers path
	this.handlers_path_ = path.join(root, 'handlers');

};
require('util').inherits(App, EventEmitter);
module.exports = App;
App.prototype.constructor = App;

App.prototype.showHelp = function() {
	console.log('Usage:');
	console.log('node ces [-c <config_filename>]');
	console.log('node ces -h for help');
	console.log('');
};

App.prototype.run = function() {
	var argv = require('minimist')(process.argv.slice(2));
	if ('h' in argv){
		this.showHelp();
		process.exit(0);
	}
	else{
		if ('c' in argv){
			this.app_config_path_ = argv['c'];
		}
	}
	this.init();
};

App.prototype.init = function() {
	var self = this
		, services;

	///////////////////////////////////////////////////
	// 初始化基本服务和配置信息
	logger.info('====================================================================');
	logger.info('Starting CES services ...');
	
	// 从appconfig中装载应用程序配置信息
	logger.info('Loading app configuration from ' + this.app_config_path_);
	var appconfig = AppConfig.loadConfig(this.app_config_path_);	

	// 初始化services中的服务
	function loadServices(cb){
		logger.info('Init services from ' + self.services_path_);
		services = ServMgr.create(self.services_path_, appconfig['services']||{});
		logger.info('Pre-loading service ...');
		services.preload(function(){
			// 预加载服务完成
			logger.info('Pre-load services finished.');

			setImmediate(function(){
				cb && cb(services);
			});
			
		});	
	}

	// 加入集群
	function joinCluster(cb){
		logger.info('Joining cluster pid #%s ...', process.pid);
		var applier = new Applier(appconfig['zookeeper']||{});
		applier.on('error', function(err){
			logger.error('Joining cluster failure, process must exit.' + err);
			process.exit(1);
		});
		applier.on('joined', function(nodeid){
			self.nodeid = nodeid;
			logger.info('Node #%s joined.', self.nodeid);

			// 注册集群中节点移除事件
			applier.on('removed', function(nodeid){
				 logger.debug('Node #%s removed.', nodeid);
			});
			// 注册集群中新增节点事件
			applier.on('added', function(nodeid){
				logger.debug('Node #%s added.', nodeid);
				//
				// 注意：投票动作在recv中负责处理
				//
			});

			cb && cb(applier);

		});

		// 执行加入
		applier.join();		
	}

	// 开始CES服务
	function startCES(applier, cb){
		// 开始提供Event Handle Broke服务
		logger.info('Starting Event-Handle-Broker ...');
		var eventstream = services.get('eventstream');
		var recv = new Receiver(eventstream, applier);
		var sender = new Sender(eventstream, applier);
		var broker = new EventBroker(recv, sender, services);
		broker.configure(appconfig['broker']||{});
		broker.run();

		cb && cb();
	}

	//////////////////////////////////////////////////////////////////////
	// 							初始化app								//
	//////////////////////////////////////////////////////////////////////

	// 初始化服务
	loadServices(function(services){
		if (appconfig.cluster) { // Cluster mode
			// 加入集群
			joinCluster(function(applier){
				// 启动CES服务
				startCES(applier, function(){
					logger.info('CES services is running in Cluster mode.');
				});
			});
		}
		else { // Stand-alone mode
			startCES(null, function(){
				logger.info('CES services is running in Stand-alone mode.');
			});
		}
	});

};