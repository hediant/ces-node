var SequentialHandler = require('../SequentialHandler');

function ForSequenceTestHandler(topic, broker){
	SequentialHandler.call(this, topic, broker);

	// TODO
	// Add your own initialize functions here
	this.on('message', this.handleEvent);

	// Close when handler destroy
	this.on('close', function(){
		// TODO
	});

};
require('util').inherits(ForSequenceTestHandler, SequentialHandler);
module.exports = ForSequenceTestHandler;
ForSequenceTestHandler.prototype.constructor = ForSequenceTestHandler;

// -- TODO --
/******************************************************************
 *     Add your own prototype members here.                       *
 *                                                                *
 ******************************************************************/

ForSequenceTestHandler.prototype.handleEvent = function(topic, fields) {
	// TODO
	// Add your own functions here
	var self = this;
	var snapshot = this.services.get('athena.live');
	if (snapshot && snapshot.isEnabled()){
		snapshot.setSystemValues(topic, fields, function(err, ret){
			if (err) {
				console.log(err);
			}

			// DO NOT FORGET !!!
			self.nextEvent();
		});
	}
	else{
		// DO NOT FORGET !!!
		self.nextEvent();
	}
};