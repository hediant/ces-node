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
	var snapshot = this.services.get('athena.snapshot');
	if (snapshot && snapshot.isEnabled()){
		snapshot.push(topic, fields, function(err, ret){
			if (err) {
				console.log(err);
			}
		});
	}
};