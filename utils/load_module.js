function initModules (module_fullpath, reload) {
	// 
	// NOTE:
	// 	 如果存在 & reload==true 需要重新载入
	// 
	var path_ = module_fullpath;
	if (require.cache.hasOwnProperty(path_) && reload)
		delete require.cache[path_];

	return require(path_);
};

module.exports = initModules;