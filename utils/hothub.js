//
// 监视目录下js的变化，删除过期的require.cache
// 调用者需要订阅该对象的change事件
// 该事件将返回受影响的文件（ids）列表（绝对路径）
//
var path = require('path')
	, Watch = require('watch.io')
	, EventEmitter = require('events').EventEmitter;

function Hothub(path){
	EventEmitter.call(this);
	this.watch_path_ = path;
	this.doWatch();
};
require('util').inherits(Hothub, EventEmitter);
Hothub.prototype.constructor = Hothub;
module.exports = Hothub;

Hothub.prototype.doWatch = function() {
	var watcher = new Watch()
		, self = this
		, watch_path = path.resolve(self.watch_path_);

	watcher.watch(watch_path);
	watcher.on('change', function(type, file, stat){
		// whatever it's add, remove, update or refresh
		// but it must be javascript file
		if (!file || path.extname(file).toLowerCase() != '.js'){
			return;
		}
		// 从require.cache缓存中删除
		logger.debug('remove require.cache[' + file + ']');

		// 获得文件以及从文件中派生的类的清单
		// 删除派生类的实例
		var module_type = require.cache[file];
		if (!module_type)
			return;
		delete require.cache[file];

		var ids = [file]; // 这个文件一定在handlers指定的目录内	
		var parent = module_type.parent;
		while(parent){
			var id = parent.id;
			// 判断该文件是不是在handlers指定的目录内
			if (id.indexOf(watch_path, id) == 0){
				ids.push(id);
				delete require.cache[id];
			}			
			parent = parent.parent;			
		}

		// 触发收影响的文件列表
		self.emit('change', ids);
	});
};
