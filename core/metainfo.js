var EventEmitter = require('events').EventEmitter
	, path = require('path')
	, Hothub = require('./hothub')
	, loadModule = require('../utils/load_module');

function MetaInfo(info_folder) {
	EventEmitter.call(this);
	this.info_folder_ = info_folder;

	this.init();
}

require('util').inherits(MetaInfo, EventEmitter);
module.exports = MetaInfo;

MetaInfo.prototype.init = function() {
	var self = this;
	this.event_class_file_ = "eventclass.js";
	this.rule_file_ = "rules.js";

	this.event_class_path_ = path.resolve(path.join(this.info_folder_, this.event_class_file_));
	this.rule_path_ = path.resolve(path.join(this.info_folder_, this.rule_file_));

	// event classes & rules
	// 
	// 有两种策略：
	// 1、规则集需要从configuration服务器上获得。
	// 2、规则集从本地文件中获得。
	// 这里采用的是第2种规则
	// 因为规则需要全加载才有效，如果放在本地磁盘上，由于watcher会监视folder的变化
	// 当规则文件改变时，会自动重新载入服务。
	//（由于规则影响大面积的主题，因此重新载入metainfo服务的效果与重新载入一条规则相当）
	//	
	this.classes_ = loadModule(this.event_class_path_);
	this.rules_ = loadModule(this.rule_path_);

	// begin watch the changes of folder
	logger.info('Watching at', path.resolve(this.info_folder_));

	this.watcher_ = new Hothub(this.info_folder_);
	this.watcher_.on('change', function(){
		self.onMetaInfoChanged();
	});	
};

MetaInfo.prototype.close = function() {
	this.watcher_ && this.watcher_.close();
	this.removeAllListeners();
};

//
// topic - string
//
MetaInfo.prototype.match = function(topic) {
	var self = this;
	var fields = {};

	for (var i=0; i<this.rules_.length; i++){
		var rule = this.rules_[i];
		if (rule.pattern.test(topic)){
			fields = {
				'handler' : rule.handler
			};

			return fields;
		}
	}	
};

//
// topic - string, topic name
// event_class - string, event class name
// cb - function, callback(meta - object)
//
MetaInfo.prototype.read = function(topic, event_class, cb) {
	var self = this;

	// find in event classes
	var class_ = this.classes_[event_class];
	if (class_) {
		cb && cb(create_meta(class_));
		return;
	}

	// find in rules
	var match_ = this.match(topic);
	if (match_)
		cb && cb(create_meta(match_));
	else
		cb && cb(null);
};

function create_meta (fields) {
	// default meta object, currently it's empty 
	// we will set it in future
	var ret = {};
	for (var key in fields){
		ret[key] = fields[key];
	}
	return ret;
}

MetaInfo.prototype.onMetaInfoChanged = function() {
	// reload modules
	this.classes_ = loadModule(this.event_class_path_, true);
	this.rules_ = loadModule(this.rule_path_, true);

	// emit event
	this.emit('changed');
};