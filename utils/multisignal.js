var Emitter = require('events').EventEmitter;
var util = require('util');

function MultiSignal(signals){
	Emitter.call(this);

	this.slots_ = {};	
	var self = this;
	if (Array.isArray(signals)){
		signals.forEach(function(s){
			self.set(s);
		});
	}
};
util.inherits(MultiSignal, Emitter);
MultiSignal.prototype.constructor = MultiSignal;

module.exports = MultiSignal;

MultiSignal.prototype.set = function(signal) {
	this.slots_[signal] = true;
};

MultiSignal.prototype.clear = function(signal) {
	if (this.slots_.hasOwnProperty(signal)){
		this.slots_[signal] = false;
		this.isHappeny();
	} 
};

MultiSignal.prototype.isHappeny = function() {
	for(var signal in this.slots_){
		if (this.slots_[signal])
			return;
	}
	this.emit('done');
};

