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
		_.assign(config, require(path.join(config_path, file)))
	})
}