/*
 * Basic service class
 */

var EventEmitter = require('events').EventEmitter;

function BaseService(folder, config, name){
	EventEmitter.call(this);
	var self = this;

	this.name_ = name || "";
	this.public_ = {};
	this.config_ = config || {};
	this.service_root_ = folder;
}
require('util').inherits(BaseService, EventEmitter);
BaseService.prototype.constructor = BaseService;
module.exports = BaseService;

BaseService.prototype.endpoints = function(){
	return Object.keys(this.public_);
};
