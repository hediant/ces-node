/*
 * cluster join applier
 */

var EventEmitter = require('events').EventEmitter
	,DistMutex = require('../zk/distmutex')
	,Vote = require('../zk/vote')
	,MultiSignal = require('../utils/multisignal')
	ZkHelper = require('../zk/zkhelper')

//
// 申请加入集群的处理器
// 方法：
//		join
//		vote (当有节点申请加入到集群中时，当前节点处理完自身任务后需要调用vote完成投票)
//		close
// 事件：
//		joined (本次申请加入集群完成，返回nodeid)
//		removed (有一个节点从集群中移除)
//		added (有一个节点申请加入到集群中来)		
//		error (只有fatal error才会触发)
//
function Applier(zkconfig){	
	EventEmitter.call(this);

	var self = this;
	this.zkConfig_ = zkconfig;

    this.executors_ = {};
    this.exec_folder_ = '/execs';
    this.exec_prefix = '/N_';

}
require('util').inherits(Applier, EventEmitter);
module.exports = Applier;

Applier.prototype.handleErrors = function() {
	var self = this;
	this.zkhelper_ && this.zkhelper_.on('error', function(error){
		logger.fatal('zookeeper error %j, process #%s must exit.', error.stack, process.pid);
		self.emit('error', 'Access zookeeper server error.');
	});

	this.vote_ && this.vote_.on('error', function(error){
		logger.fatal('vote error %j, process #%s must exit.', error.stack, process.pid);
		self.emit('error', 'Vote error.');	
	});
};

/****************************************
 1. try mutex until we got it.
 2. zkhelper.getNodes() => executors
 3. Vote.create(executors => voters)
 4. applier.register {
 4.1	zkhelp.create(new nodeid => applier.nodeid) 
 4.2	consistent-hashing.create(executors) && addNode(applier.nodeid) && got affected_executors
 }
 5. watch voted event, while all of affected_executors voted, then applier init && ready.
 6. watch vote close event, then release mutex.
****/
Applier.prototype.join = function(cb) {
	var self = this;

	// 创建一个与zk的连接，专门用于申请过程
	var zkhelper = new ZkHelper(this.zkConfig_);
	zkhelper.once('connected', function(){
		self.doJoin(zkhelper, cb);
	});

	// 开始连接
	zkhelper.connect();

	return this;
};

Applier.prototype.doJoin = function(zkhelper, cb) {
	// 创建分布式锁
	var dmutex = new DistMutex(zkhelper.client),
		// 投票的发起人
		myVote = new Vote(zkhelper.client),
		mutex_key = 'join_vote',
		self = this;
	logger.debug('process #%s is Tring to get mutex.', process.pid);

	//////////////////////////////////////////////////////////
	// NOTE!
	// 必须确保，同时只有一个申请加入集群的节点
	// 
	dmutex.on('error', function(error){
		logger.fatal('Tring mutex error %j, process #%s must exit.', error.stack, process.pid);
		process.exit(1);		
	});	

	// tring enter mutex
	dmutex.try(mutex_key, function(){
		// 如果成功进入分布式锁
		logger.debug('process #%s has got mutex.', process.pid);

		var retAndClear = function(hasVoted){
			if (hasVoted) 
				myVote.release();

			// 注意：
			// dmutex需要放在callback之前，因为后续会直接释放zkhelper
			dmutex && dmutex.release(mutex_key);
			zkhelper && zkhelper.close();

			cb && cb();			
			logger.debug('process #%s has released mutex, new node %s joined.', process.pid, self.nodeid);
		};

		// 列出所有参与投票的成员（其实就是所有的EXECUTORS）
		var folder = self.exec_folder_;
		var voters = {};
		zkhelper.listAndWatchNodes(folder, function(members){
			// 如果是集群中第一个节点就不必投票了
			if (members.length == 0){ 				
				self.register(function(){
					self.emit('joined', self.nodeid);
					retAndClear(false);
				});
			}
			// 如果集群中有其它的节点，则需要发起投票
			else{ 
				members.forEach(function(nodeid){
					voters[nodeid] = 1;
				});

				// 响应参与投票成员的变化（这里只考虑成员退出的情况）
				// 因为，有分布式锁的情况下，只会有一个节点试图加入，而这个节点就是自己。
				zkhelper.on('exec_changed', function(new_members){
					for (var member in voters){
						if (new_members.indexOf(member) < 0){
							// 删除退出的投票成员
							myVote.delMember(member);
							logger.debug('Vote sponsor %s received that node %s has removed.', self.nodeid, member);
							delete voters[member];
						}
					}
				});

				// 创建新的投票
				myVote.create(members, function(){
					var signal = new MultiSignal(['vote_closed', 'registed']);
					signal.once('done', function(){
						// 设置broker为ready状态
						self.emit('joined', self.nodeid);
						retAndClear(true);						
					});
					myVote.once('close', function(){
						signal.clear('vote_closed');
					});
					
					//
					// 申请注册并加入集群。
					//
					self.register(function(){
						signal.clear('registed');
					});
				});			
			}
		});
	});
};

Applier.prototype.register = function(cb) {
	var self = this;
	this.zkhelper_ = new ZkHelper(this.zkConfig_);

	// 创建新的节点
	var node_token = this.exec_folder_ + this.exec_prefix;
	this.zkhelper_.once('connected', function(){
		self.zkhelper_.createNode(node_token, function(nodeid){
			self.nodeid = nodeid;
			self.listAndWatchExecutors(function(){
				cb && cb();
			});
		});	

		// 仅作为成员投票用，不要在这里创建新的VOTE
		self.vote_ = new Vote(self.zkhelper_.client);		
	});

	// 快速失效
	this.handleErrors();

	// 创建连接
	this.zkhelper_.connect();
};

Applier.prototype.listAndWatchExecutors = function(cb) {
	var self = this;
	var folder = self.exec_folder_;

	this.zkhelper_.listAndWatchNodes(folder, function(nodes){
        for(var i=0; i<nodes.length; i++){
            self.executors_[nodes[i]] = 1;
        }
        self.zkhelper_.on('exec_changed', function(nodes){
           	self.execNodesChanged(nodes);
        });
		cb && cb();
	});	
};

Applier.prototype.execNodesChanged = function(nodes) {
    for(var i=0; i<nodes.length; i++){
    	if (!this.executors_[nodes[i]]){
            this.executors_[nodes[i]] = 2;

            // add nodeid
        	this.emit('added', nodes[i]);
        }
        else{
            this.executors_[nodes[i]] ++;
        }    	
    }

    for(var exec in this.executors_){
        if (! --this.executors_[exec]){ // == 0
            delete this.executors_[exec];

            // remove nodeid
            this.emit('removed', exec);
        }
    }
};

Applier.prototype.vote = function(nodeid, cb) {
	this.vote_.vote(nodeid, cb);
};

Applier.prototype.close = function(){
	this.vote_ && this.vote_.release();
	this.zkhelper_ && this.zkhelper_.close();
};