var zookeeper = require('node-zookeeper-client') 
    , EventEmiter = require('events').EventEmitter
    , path = require('path');

/**
 * Create a zookeeper client and get/watch POSTMEN/EXECUTORS.
 * @config
 */
var ZkHelper = function (config) {
    EventEmiter.call(this);

    this.config_ = config;
    var conn = [];
    if (config.conn){
        for(var i=0; i<config.conn.length; i++){
            conn.push(config.conn[i].addr + ':' + config.conn[i].port);
        }
    }
    var connectionString = (conn.length == 0) ? 
        'localhost:2181' :
        conn.join(',');

    // create zookeeper client socket
    // this socket will re-connected automatically
    // if one of zookeeper client is disconnected with zookeeper server
    // it will emit 'connect' event again
    this.client = zookeeper.createClient(connectionString,{
        sessionTimeout: config.sessionTimeout,
        spinDelay : config.spinDelay,
        retries : config.retries
    });

    var self = this;
    this.client.on('connected', function () {
        self.emit('connected');
    });
};

require('util').inherits(ZkHelper, EventEmiter);
ZkHelper.prototype.constructor = ZkHelper;

ZkHelper.prototype.connect = function() {
    var self = this;
    this.client.on('error', function(error){
        self.emit('error', error);
    });
    this.client.connect();
    return this;
};

ZkHelper.prototype.createNode = function(node_token, cb){
    var self = this;
    this.client.create(
        node_token,
        null,
        zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL,
        function (error, fullname) {
            if (error) {
                logger.error('create node %s error %j', node_token, error.stack);
                self.emit('error', error);
            }
            var nodeid = path.basename(fullname);
            cb && cb(nodeid);
        }
    );
    return this;
};

ZkHelper.prototype.listAndWatchNodes = function (folder, cb) {
    var self = this;
    this.client.getChildren(
        folder,
        function (event) {
            self.listAndWatchNodes(folder);
        },
        function (error, children, stat) {
            if (error) {
                logger.error(
                    'Failed to list children of %s due to: %j.',
                    folder,
                    error.stack
                );

                self.emit('error', error);
                return;
            }

            // 如下这两个函数的顺序不能颠倒
            cb && cb(children);
            self.emit('exec_changed', children);
        }
    );
    
    return this;
};

ZkHelper.prototype.close = function() {
    this.client.close();
    this.removeAllListeners();
};

module.exports = ZkHelper;