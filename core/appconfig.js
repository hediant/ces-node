var fs = require('fs')
	, _ = require('lodash')
	, path = require('path');

//
// Global Configuration
//
config = {};

exports.loadConfig = function (config_path){
	var config_files = fs.readdirSync(config_path);
	config_files.forEach (function (file){
		var pair = {};
		pair[path.basename(file, ".js")] = require(path.join(config_path, file));

		_.assign(config, pair);
	})
}