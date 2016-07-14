/*
 * Events Sender
 */

var EventEmitter = require('events').EventEmitter;

function EventSender(event_stream_service, applier){
	this.event_stream_service_ = event_stream_service;
	this.applier_ = applier;

	// for diagnosis
	this.send_counter_ = 0;
}
require('util').inherits(EventSender, EventEmitter);
module.exports = EventSender;

EventEmitter.prototype.fire = function(topic, event_class, fields) {
	if (this.event_stream_service_.isEnabled()) {
		// for diagnosis
		this.send_counter_++;
		
		this.event_stream_service_.fire(topic, event_class, fields);
	}
};