var ces = require('ces-node');
var BaseHandler = ces.BaseHandler
	, STW = ces.SlidingTimeWindow;

function ExampleHandler(topic, broker, event_class){
	BaseHandler.call(this, topic, broker, event_class);

	// TODO
	// Add your own initialize functions here
	this.on('message', this.handleEvent);

	// Close when handler destroy
	this.on('close', function(){
		// TODO
	});

	// 创建滑动时间窗口
	this.stw_ = new STW(topic, 30 * 1000);

};
require('util').inherits(ExampleHandler, BaseHandler);
module.exports = ExampleHandler;
ExampleHandler.prototype.constructor = ExampleHandler;

// -- TODO --
/******************************************************************
 *     Add your own prototype members here.                       *
 *                                                                *
 ******************************************************************/

ExampleHandler.prototype.handleEvent = function(topic, fields) {
	// TODO
	// Add your own functions here

	console.log('----------------- Demo/ExampleHandler -------------------');
	console.log('Topic:', topic);

	console.log('Fields:', JSON.stringify(fields));
	console.log('Services: ');
	console.log(Object.keys(services));
	console.log('comment me to see what\'s going on!');

	// 滑动时间窗口
	console.log('SlideTimeWindow');
	console.log(this.stw_.getSeries());
	
	//
	// 发射事件DEMO
	// 需要特别注意如下的写法，否则将会陷入无尽的循环中
	//
	if (topic != 'test_fire') {
		this.sender.fire('test_fire', "demo", {'average':10});
	}

	//
	// NOTE:
	// 不要忘记实现滑动
	//
	this.stw_.slide(topic, fields.data, fields.recv);
};