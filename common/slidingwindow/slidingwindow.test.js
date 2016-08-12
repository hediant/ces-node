var STW = require('./').SlidingTimeWindow;
var SCW = require('./').SlidingCountWindow;

var topic = "test";
var period =  10*1000;	// ms
var count = 5;
var x = 0;
var y = 0;


function testSlideTime() {
	var stw = new STW(topic, period);
	setInterval(function(){
		var data = {};
		if (Math.random()>0.5){
			data["y"] = --y;
		};
		if (Math.random()>0.5){
			data["x"] = ++x;
		};

		var fields = {
			"data" : data,
			"recv" : (new Date()).valueOf()
		};
		stw.slide(topic, fields.data, fields.recv);
		console.log(stw.getSeries());
	}, 1000);
}

function testSlideCount() {
	var scw = new SCW(topic, count);
	setInterval(function(){
		var data = {};
		if (Math.random()>0.5){
			data["y"] = --y;
		};
		if (Math.random()>0.5){
			data["x"] = ++x;
		};

		var fields = {
			"data" : data,
			"recv" : (new Date()).valueOf()
		};

		scw.slide(topic, fields.data, fields.recv);
		console.log(scw.getSeries());
	}, 1000);
}

//testSlideCount();
testSlideTime();

