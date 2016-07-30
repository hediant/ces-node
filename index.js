var App = require('./core/app');

//
// Base Handlers
//
exports.BaseHandler = require('./handlers/BaseHandler');
exports.SequentialHandler = require('./handlers/SequentialHandler');

//
// Base Services
//
exports.BaseService = require('./common/baseservice');

//
// Sliding Windows
//
exports.SlidingWindow = require('./common/slidingwindow');
exports.SlidingTimeWindow = exports.SlidingWindow.SlidingTimeWindow;
exports.SlidingCountWindow = exports.SlidingWindow.SlidingCountWindow;

//
// Run CES Service Instance
//
exports.lift = function (work_path, config){
	var app = new App(work_path, config);
	app.run();
}