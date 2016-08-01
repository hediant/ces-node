var fs = require('fs')
	, _ = require('lodash')
	, path = require('path');

//
// Global Services
//
services = {};

var loadService = function (serv_name, serv_root){
	logger.info("Loading service <%s>", serv_name);

	// load
	services[serv_name] = require(serv_root);
}

var loadAllServices = function (services_folder){
	var ids = fs.readdirSync(services_folder);
	ids.forEach(function (id){
		var res = path.join(services_folder, id);
		var serv_name;

		// if directory
		if (fs.statSync(res).isDirectory()){
			serv_name = id;
		}

		if (serv_name){
			// load service
			loadService(serv_name, res);
		}
	})
}

exports.loadAllServices = loadAllServices;