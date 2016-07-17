var BaseHandler = require('../BaseHandler');

function BenchHandler(topic, broker){
	BaseHandler.call(this, topic, broker);

	// TODO
	// Add your own initialize functions here
	this.on('message', this.handleEvent);

	// Close when handler destroy
	this.on('close', function(){
		// TODO
	});

};
require('util').inherits(BenchHandler, BaseHandler);
module.exports = BenchHandler;
BenchHandler.prototype.constructor = BenchHandler;

// -- TODO --
/******************************************************************
 *     Add your own prototype members here.                       *
 *                                                                *
 ******************************************************************/

BenchHandler.prototype.handleEvent = function(topic, fields) {
	// TODO
	// Add your own functions here
	if (!fields || typeof fields.data != "object")
		return;

	var snapshot = this.services.get('athena.live');
	if (snapshot && snapshot.isEnabled()){
		var data = {};
		for (var key in fields.data){
			data[key] = {
				"val" : fields.data[key],
				"ts" : fields.recv
			}
		}

		snapshot.setSystemValues(topic, data, function(err, ret){
			if (err) {
				console.log(err);
			}
		});
	}
};