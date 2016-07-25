var fs = require('fs');

function AppConfig(){};

AppConfig.loadConfig = function(appconf){
	var config = new AppConfig();
	if (!fs.existsSync(appconf)){
		logger.error(appconf + ' NOT found!');
		process.abort();
	}

	config.load(appconf);	
	return config;
};

AppConfig.prototype.load = function(path){
	this.config_file_path_ = path;
	try{
		var cfgjson = JSON.parse(fs.readFileSync(path, {'encoding':'utf-8'}));
		for(var key in cfgjson){
			this[key] = cfgjson[key];
		}
	}
	catch(ex){
		logger.error(ex);
		process.abort();
	}
};

module.exports = AppConfig;
