/*
 * messages service wrapper class
 */
var mysql = require('mysql');
var dateFormat = require('dateformat');
var AliMNS = require("ali-mns");
var promise = require("promise");
var BaseService = require('../../common/baseservice');
var Accounts = require('../../../account');
var async = require('async');
var noticeSubscribe = Accounts.NoticeSubscribe;


//
// 事件处理器基类
// folder - string, 该服务所在的绝对路径
//
function Messages(folder, config){
	BaseService.call(this, folder, config, 'messages');

	var self = this;
	this.on('init', function(){
		self.init();
	});
	this.account_ = new AliMNS.Account(
		this.config_.mns.account_id,
		this.config_.mns.accesskey_id,
		this.config_.mns.accesskey_secret
	);


	this.pool_ = mysql.createPool(this.config_.server);
	// 不要忘记响应关闭事件
	this.on('close', function(){
		self.pool_.end();
		this.removeAllListeners();
	});
};

require('util').inherits(Messages, BaseService);
Messages.prototype.constructor = Messages;
module.exports=Messages;

Messages.prototype.init = function() {
	var self = this;

	// 需要公开访问的服务的方法在这里定义
	this.public_ = {
		'publish' : this.publish,
        'publishServiceMsg' : this.publishServiceMsg,
		'dispatch' : this.dispatch
	};

    var topics = this.config_.mns.topics;
    this.topics_ = {};
    topics.forEach(function(topic_name){
            self.topics_[topic_name] = new AliMNS.Topic(topic_name, self.account_, self.config_.mns.region);
    });

	if (!this.initDbServer())
		return;

    this.emit('ready');

};



Messages.prototype.initDbServer = function() {
	var self = this;
	if (!this.config_.server) {
		this.emit('error', "BAD_CONFIG_SETTINGS");
		return;
	}

	Accounts.setDbConnection(this.pool_);

	this.pool_.on('connect', function(){
		logger.debug("service <%s> connect to database, %s.", this.name_, JSON.stringify(this.config_.server));
	});

	this.pool_.on('error', function(err){
		logger.error("server <%s> error: %s", this.name_, err.message);

		// re-connect ?
		self.pool_.end();
		self.initDbServer();
	});
	// return
	return true;
};


Messages.prototype.publish = function (alarm_info, sendees, cb) {
	var self = this;
	var vaild_sendees = parseSendees(sendees);
    var msg = {
        "topic" : "ALARM",
        "ts" : Date.now(),
        "body": alarm_info,
        "sendees" : vaild_sendees.users
    }
    var alarm_topic = this.topics_["ALARM"];
    alarm_topic.publishP(JSON.stringify(msg),true).then(
        function (result){
            cb();
        },
        function (err){
            console.error("publish ALARM message error:",err);
            cb(err);
        }
    );
};

Messages.prototype.publishServiceMsg = function(msg, cb){
    var self = this;
    var service_topic = this.topics_["SERVICE"];
    service_topic.publishP(JSON.stringify(msg),true).then(
        function (result){
            cb();
        },
        function (err){
            console.error("publish SERVICE message error:",err);
            cb(err);
        }
    );

}

Messages.prototype.dispatch = function (filter, cb){
	noticeSubscribe.dispatch(filter, cb);
}


function parseSendees(sendees) {
	var ret = {
		"users": [],
		"tickets": []
	}

	sendees.forEach(function (sendee) {
		if (sendee.user_id) {
			ret.users.push(sendee.user_id);
		}
		if (sendee.ticket) {
			ret.tickets.push(sendee.ticket);
		}
	});
	return ret;
}

