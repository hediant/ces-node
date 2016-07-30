/*
 * Application Entry-point
 */
const VER = "v0.1.0";

var EventEmitter = require('events').EventEmitter
	, AppConfig = require('./appconfig')
	, ServMgr = require('./servicesmgr')
	, Applier = require('./applier')
	, Receiver = require('./recv')
	, Sender = require('./sender')
	, EventBroker = require('./broker')
	, path = require('path');

function App(work_path, config){
	EventEmitter.call(this);

	this.work_path_ = path.resolve(work_path);
	// default app config path
	this.app_config_path_ = path.join(this.work_path_, 'config');
	// default services path
	this.services_path_ = path.join(this.work_path_, 'services');

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
	// init config
	AppConfig.loadConfig(this.app_config_path_);

	// 初始化日志记录
	require('../utils/logger').use(config.log4js, 'ces');

	this.init();
};

App.prototype.init = function() {
	var self = this
		, services;

	///////////////////////////////////////////////////
	// 初始化基本服务和配置信息
	logger.info('====================================================================');
	logger.info('Starting CES services ...');
	logger.info("      ___ ___  ___" );
	logger.info("    / __/ _ \\/ __|");
	logger.info("   | (_|  __/\\__ \\");
	logger.info("    \\___\\___||___/");
	logger.info("   ");
	logger.info("   Author: hediant@gmail.com");
	logger.info("   CreateAt: 2015-10-01");
	logger.info("   Ver: ", VER);
	logger.info("   ");

	// 初始化services中的服务
	function loadServices(cb){
		logger.info('Init services from ' + self.services_path_);
		services = ServMgr.create(self.services_path_, config['services']||{});
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
		broker.configure(self.work_path_);
		broker.run();

		cb && cb();
	}

	//////////////////////////////////////////////////////////////////////
	// 							初始化app								//
	//////////////////////////////////////////////////////////////////////

	// 初始化服务
	loadServices(function(services){
		if (config.local.cluster) { // Cluster mode
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