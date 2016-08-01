var App = require('./core/app');

//
// Base Handlers
//
exports.BaseHandler = require('./common/BaseHandler');
exports.SequentialHandler = require('./common/SequentialHandler');

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