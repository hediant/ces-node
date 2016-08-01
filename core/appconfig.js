var fs = require('fs')
	, _ = require('lodash')
	, path = require('path');

//
// Global Configuration
//
config = {};

var loadConfig = function (config_path, cfg){
	var config_files = fs.readdirSync(config_path);
	config_files.forEach (function (file){
		var res = path.join(config_path, file);

		// if directory
		if (fs.statSync(res).isDirectory()){
			cfg[file] = {};
			loadConfig(res, cfg[file]);
		}
		else {
			// if file
			var pair = {};

			switch(path.extname(file).toLowerCase()){
				case ".js":
					pair[path.basename(file, ".js")] = require(path.join(config_path, file));
					break;
				case ".json":
					pair[path.basename(file, ".json")] = require(path.join(config_path, file));
					break;
				default:
					break;
			}
			

			_.assign(cfg, pair);
		}
	})
}

exports.loadConfig = function (config_path){
	loadConfig(config_path, config);
};