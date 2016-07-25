var zookeeper = require('node-zookeeper-client')
	,EventEmitter = require('events').EventEmitter
	,ZkHelper = require('./zkhelper')
	,path = require('path');

function Vote(zkClient){
	EventEmitter.call(this);

	this.zkClient_ = zkClient;
	this.vote_path = '/vote';
	this.vote_start = this.vote_path+'/start';

	this.voters_ = {};
	this.openning = false;
}
require('util').inherits(Vote, EventEmitter);
Vote.prototype.constructor = Vote;
module.exports = Vote;

Vote.prototype.memberPath = function(nodeid) {
	return path.join(this.vote_path, nodeid).replace(/\\/g, '/');
};

Vote.prototype.addMember = function(nodeid, cb) {
	var self = this;
	this.zkClient_.create(
		this.memberPath(nodeid),
		null,
		zookeeper.CreateMode.EPHEMERAL,
		function (error, fullpath) {
	        if (error) {
	            logger.error('create node %s error %j', nodeid, error.stack);
	            self.emit('error', error);
	            return;
	        }

	        cb && cb(path.basename(fullpath));            
	    }
	);
};

Vote.prototype.delMember = function(nodeid) {
	delete this.voters_[nodeid];
	if (Object.keys(this.voters_).length == 0){
		this.close();
	}
};

Vote.prototype.addMembers = function(members, cb) {
	var self = this;
	var cur = 0, len = members.length;

	members.forEach(function(nodeid){
		self.addMember(nodeid, function(fullpath){
			self.voters_[nodeid] = 1;
			if (++cur == len) {
				cb && cb();
			}
		});
	});	
};

Vote.prototype.close = function(cb) {
	var self = this;
	self.zkClient_.getChildren(self.vote_path, null, function(error, children, stat){
		if (error){
			logger.error('list %s error %j', self.vote_path, error.stack);
			self.emit('error', error);
			return;
		}

		var cur=0, len=children.length;
		if (cur == len){
			cb && cb();
			return;
		}

		children.forEach(function(child){
			var delete_path = self.vote_path+'/'+child
			self.zkClient_.remove(delete_path, -1, function(error){
				if (error && error.name != 'NO_NODE'){
					// 如果不是删除的节点不存在
					logger.error('delete %s error %j', delete_path, error.stack);
					self.emit('error', error);
					return;
				}

				if (++cur == len) cb && cb();
			});
		});
	})
};

///////////////////////////////////////////////////////////////////////////
// Note: 
// 只有选举的主席可以发起投票，即：调用create
// 成员不能发起投票（调用create），而只能对自己进行投票（调用vote）
//
Vote.prototype.create = function(members, cb) {
	var self = this;
	var cur = 0, len = members.length;

	// begin watch voted and close event once vote create
	this.once('create', function(){
		self.openning = true;
		self.watchVotedEvent();

		cb && cb();
	});

	// add members
	this.once('init', function(){
		self.addMembers(members, function(){
			// create start flags
			self.zkClient_.create(
				self.vote_start,
				null,
				zookeeper.CreateMode.EPHEMERAL,
				function (error, fullpath) {
			        if (error) {
			            logger.error('create node %s error %j', fullpath, error.stack);
			            self.emit('error', error);
			       	}
			        // watch start flags change to NODE_DELETED
			        // and emit close event
					self.zkClient_.exists(self.vote_start,
						function(event){ // watch vote close event
							if (event.name == 'NODE_DELETED') self.emit('close');
						},
						function(error, stat){
							if (error || !stat){
								logger.error('create vote failure.');
								self.emit('error', error);
								return;
							}

							// emit vote create event
							self.emit('create');
						}
					);
				}
			);
		});	
	});	

	// close previous vote and watch new vote create
	this.close(function(){
		self.emit('init');
	});

};

Vote.prototype.vote = function(nodeid, cb) {
	var self = this;
	var delete_path = this.vote_path + '/' + nodeid;
	
	this.zkClient_.remove(delete_path, -1, function(error){
		if (error && error.name != 'NO_NODE'){
			// 如果不是删除的节点不存在
			logger.error('vote %s error %j', nodeid, error.stack);
			self.emit('error', error);
		}
		cb && cb(error);
	});
};

Vote.prototype.listAndWatchVoters = function(cb) {
	if (this.closed)
		return;

	var self = this;
	this.zkClient_.getChildren(
		this.vote_path,
		function(event){
			self.listAndWatchVoters();
		},
		function(error, children, stat) {
            if (error) {
                logger.error('Failed to list children of %s due to: %j.',
                    self.vote_path,
                    error);

                self.emit('error', error);
                return;
            }
 
            self.emit('changed', children);
            cb && cb(children);
        }
	);
};

Vote.prototype.watchVotedEvent = function() {
	var self = this;
	this.on('changed', function(voters){
		var leaveVoters = {};
		for(var i=0; i<voters.length; i++){
			leaveVoters[voters[i]] = 1;
		}
	
		for(var nodeid in self.voters_){
			if (!leaveVoters.hasOwnProperty(nodeid)){
				self.emit('voted', nodeid);
				delete self.voters_[nodeid];

				if (Object.keys(self.voters_).length == 0){
					self.close();
				}
			}
		}
	});

	this.listAndWatchVoters();
};

// 注意：
// close方法用于关闭投票
// release方法用于释放对象
Vote.prototype.release = function() {
	this.closed = true;
	this.removeAllListeners();
};