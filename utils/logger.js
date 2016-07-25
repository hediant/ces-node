var log4js = require('log4js')
	,path = require('path');

////////////////////////////////////////////////////////////////////
// usage:
/*
	require('../utils/logger').use(config, name);

	logger.trace('Entering cheese testing');
	logger.debug('Got cheese.');
	logger.info('Cheese is Gouda.');
	logger.warn('Cheese is quite smelly.');
	logger.error('Cheese is too ripe!');
	logger.fatal('Cheese was breeding ground for listeria.');
 */

exports.use = function(config, name){
	log4js.configure(config);
	logger = log4js.getLogger(name);
};
