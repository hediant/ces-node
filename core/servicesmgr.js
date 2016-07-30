/*
 * Services addons manager
 */

var EventEmitter = require('events').EventEmitter
	, path = require('path')
	, Hothub = require('./hothub')
	, fs = require('fs')
	, Watch = require('watch.io')
	, MultiSignal = require('../utils/multisignal');

function ServicesManager(){}
require('util').inherits(ServicesManager, EventEmitter);
module.exports = ServicesManager;

ServicesManager.create = function(host_path, config){
	// 使用闭包封装services，避免调用者访问私有元素
	var services = {};
	this.service_root_ = host_path;
	this.config_ = config;

	//
	// cb(err, enable)
	//
	ServicesManager.prototype.get = function(serv_name, cb) {
		if (!services[serv_name]){
			try{
				if (!fs.existsSync(path.join(host_path, serv_name))) {
					cb && cb(new Error("SERVICE_NOT_EXIST"), false);
					return null;
				}
				
				var service_wrapper = new ServiceWrapper(host_path, serv_name, config['services']||{});
				if (service_wrapper){
					service_wrapper.onReady(function(){
						cb && cb(null, true);
					});
					service_wrapper.onDisabled(function(){
						cb && cb(null, false);
					});
					service_wrapper.onError(function(err){
						cb && cb(err, false);
					});

					services[serv_name] = service_wrapper;
				}				
			}
			catch(ex){
				logger.error(ex.message);
				logger.debug(ex.stack);

				return null;
			}
		}
		
		return services[serv_name];
	};

	ServicesManager.prototype.list = function() {
		return Object.keys(services);
	};

	ServicesManager.prototype.preload = function(cb) {
		var self = this
			, serv_list = fs.readdirSync(host_path)
			, msign = new MultiSignal();

		if (!serv_list.length)
			return cb && cb();
		
		msign.once('done', function(){
			cb && cb();
		});

		serv_list.forEach(function(servicename){

			// 启动多路信号合并器
			msign.set(servicename);
			var service_wrapper = self.get(servicename, function(err, enable){
				msign.clear(servicename);
			});
			if (!service_wrapper){
				msign.clear(servicename);
			}
		});

	};

	// return service wrapper instance
	return new ServicesManager();
}

// 
// 服务封装类
// folder - string, 所有服务所在的宿主路径 
// servicename - string, 服务名称（id）
// 
// 该类的主要作用：
// 1. 提供对服务的封装，包括
// 		装载服务
// 		初始化服务
// 		映射服务方法
// 		如果服务配置改变，重新装载服务
// 		如果服务实现代码改变，重新装载服务
// 2. 由于全局只有一个Wrapper对应，即使因为配置修改或代码更新的原因重新生成了服务实例，
//	  也并不影响调用者
//
function ServiceWrapper(folder, servicename, option){
	var self = this
		,instance_ = null
		,enabled_ = false
		,emitter_ = new EventEmitter()
		,timeout_ = option.timeout || 30000
		,retry_secs_ = option.retry_secs || 5
		,config_ = {}
		,service_root_ = path.resolve(path.join(folder, servicename))
		,config_basename_ = 'config.json'
		,first_load_ = true
		,hotwatcher_ = null
		,configwatcher_ = null
		,retry_timer_;

	self.isEnabled = function() {
		return enabled_;
	};
	self.onReady = function(cb) {
		emitter_.on('ready', function(){
			cb && cb();
		});
	};
	self.onError = function(cb) {
		emitter_.on('error', function(message){
			cb && cb(message);
		});
	};
	self.onDisabled = function(cb) {
		emitter_.on('disabled', function(){
			cb && cb();
		});
	};
	self.endpoints = function(){
		if (typeof instance_.endpoints === 'function')
			return instance_.endpoints();
		return {};
	};

	var createInstance = function() {
		enabled_ = false;
		retry_timer_ && clearTimeout(retry_timer_);	// DON'T FORGET IT!!!

		config_ = loadConfig();
		if (typeof config_ !== 'object' || !config_.enable){
			// 如果config.json文件不存在，或者加载失败
			// 如果设置为disabled
			emitter_.emit('disabled');
			return;
		}

		// 装载服务实体
		instance_ = loadService();
		if (!instance_){
			// 加载失败的情况下，该怎么处理？
			// 1、可以从servicemgr中将其移除，下一次事件到达的时候会尝试重新加载
			// 2、也可以定期重试
			// 这里暂定第1种策略
			emitter_.emit('error');			
			return;			
		}

		instance_.on('ready', function(){
			enabled_ = true;
			logger.info('Service <%s> is ready.', servicename);

			emitter_.emit('ready');
		});
		
		instance_.on('error', function(message){
			enabled_ = false;
			logger.error('Service <%s> error. %s', servicename, JSON.stringify(message));
			logger.info("Try reload serivce <%s> at %s seconds later.", servicename, retry_secs_);
			emitter_.emit('error', message);
			
			// 关闭当前服务
			instance_ && instance_.emit('close');
			delete instance_;			

			// 重试重启服务
			retry_timer_ = setTimeout(function(){
				logger.info('Reloading service <%s> ...', servicename);
				createInstance();
			}, retry_secs_*1000);
		});

		// 
		// 为什么这里要触发close事件，而不是直接调用instance_.init()?
		// 因为我们期望派生类的init方法和base类的init方法同样得到调用。
		// 由于emit的实现中事实上是同步调用的过程，
		// 因此程序的先后顺序与直接调用instance_.init()是一样的。
		//
		// 注意：
		//		父类的实现中需要特别小心如下形式的写法：
		//		this.on('init', this.funcxxx) ...
		//		因为，如果this.funcxxx是prototype方法的话，子类的实现如果也是这样的写法
		//		且方法名funcxxx一样，将会导致父类的funcxxx方法被子类funcxxx方法替换
		//		这样，父类的init或close方法将不会被调用（因为此时this已经指向子类了）。
		// 
		instance_.emit('init');
		mapping(instance_);

	};

	// 加载配置文件
	var loadConfig = function() {
		try{
			var config_filename = path.join(service_root_, config_basename_);
			var config = JSON.parse(fs.readFileSync(config_filename, {'encoding':'utf-8'}));
			if (!config.enable){
				logger.info('Service <%s> is disabled by user.', servicename);
			}
			return config;
		}
		catch(ex){
			logger.error('Loading configuration of service <%s> failure.', servicename);
			logger.debug(ex.message);
		}
	};

	// 加载服务
	var loadService = function() {
		try{
			var ServiceType = require(service_root_);
			return new ServiceType(service_root_, config_);				
		}
		catch(ex){
			logger.error('Loading service <%s> failure, error: %s .', servicename, ex.message);
		}
	};

	var mapping = function(object) {
		for (var fn in instance_.public_){
			//
			// 注意 1：
			// 这里不能使用如下的方式
			//		self[fn] = instance_[fn];
			// 因为，如果instance_[fn]的实现代码中包含"this.xxx"的代码时将得不到预期的效果
			//		预期的效果是this指向的是instance_，而事实上此时this指向的是ServiceWrapper
			//		这样将访问不可达的代码。
			//
			// 注意 2：
			//		这里使用了闭包，因为handler会随着循环而改变。
			//
			(function(handler){
				if (typeof handler === 'function') {
					self[fn] = function(){
						if (!enabled_){
							throw new Error("Service <" + servicename + "> is not ready.");
						}						
						switch (arguments.length) {
							// fast cases
					    	case 1:
					    		return handler.call(instance_, arguments[0]);
					    	case 2:
					        	return handler.call(instance_, arguments[0], arguments[1]);
					      	case 3:
					        	return handler.call(instance_, arguments[0], arguments[1], arguments[2]);
					      	// slower
					      	default:
					        	return handler.apply(instance_, Array.prototype.slice.call(arguments));
					    }
					}
				}
			})(instance_.public_[fn]);
		}

		for (var m in self){
			if (!(m in instance_.public_)){
				if (['isEnabled', 'onReady', 'onError', 'endpoints'].indexOf(m) < 0)
					delete self[m];
			}
		}
	};

	var watchconfig = function(){
		config_watcher_ = new Watch();

		// 监视配置文件
		config_watcher_.on('change', function(type, file, stat){
			if (path.basename(file) != config_basename_)
				return;

			if (first_load_){
				// 如果是初始化第一次开始监视，可以忽略
				first_load_ = false;
				if (type == 'create') return;
			}

			logger.info('Service <%s> configuration changed.', servicename);
			logger.debug('%s %s', type, file);
			reload();
		});
		config_watcher_.watch(service_root_);
	}

	// 监视服务程序和配置文件修改
	var hotwatch = function(){
		// 监视js文件修改
		hotwatcher_ = new Hothub(service_root_);
		hotwatcher_.on('change', function(ids){
			reload();
		});		
	};

	var reload = function(){
		logger.info('Reloading service <%s> ...', servicename);
		instance_ && instance_.emit('close');
		delete instance_;

		// 重新创建服务实体
		createInstance();
	};

	//
	// 注意：
	//		这里的方法是在下一个循环周期再createInstance()
	//		因为此时，ready, error和disabled事件的订阅器还没有准备好
	//
	setImmediate(function(){
		// 
		// 执行创建服务实体过程
		// 
		createInstance();

		if (config.services.watch){
			//
			// 开始监测服务程序修改事件
			//
			hotwatch();

			//
			// 开始监测服务配置信息更新事件
			//	
			watchconfig();
		}

	});

};



