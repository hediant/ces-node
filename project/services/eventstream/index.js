var StreamAPI = require('amqp-subpub');

//
// configs
//
var config_ = config.services.eventstream;

//
// stream service client
//
var stream_ = new StreamAPI(config_.stream_server.url, config_.stream_server.options);

//
// initialization
//
stream_.on('ready', function (){
	stream_.sub();
	serv_.ready = true;
});

stream_.on('error', function (err){
	logger.fatal("Service <eventstream> error:%s. We must exit.", err.message);
	console.log(err.stack);
	process.exit(1);
});

//
// event queue
//
var event_queue_ = [];

//
// timer
//
var timer_ = setInterval(function(){
	serv_.fireImmediatelly();
}, config_.max_time_to_fire);

//
// service instance
//
var serv_ = {
	// is service ready
	"ready" : false,

	// subscribe new events
	"sub" : function (cb){
		stream_.on('data', function(events){
			cb && cb(events);
		});
	},

	// unsubscribe events
	"unsub" : function (listener){
		stream_.removeListener('data', listener);
	},

	// send event
	"fire" : function (topic, event_class, fields){
		if (typeof topic !== "string") {
			throw TypeError("topic must be a string.");
		}
		if (typeof fields !== "object") {
			throw TypeError("fields must be an object.");
		}

		event_queue_.push({
			"topic" : topic,
			"class" : event_class,
			"fields" : fields
		});

		if (event_queue_.length >= config_.max_len){
			serv_.fireImmediatelly();
		}
	},

	// send event immediatelly
	"fireImmediatelly" : function (){
		if (event_queue_.length) {
			event_queue_.forEach(function(evt){
				stream_.write(evt.topic, evt.class, evt.fields);
			});

			event_queue_ = [];
		}
	}
}

module.exports = serv_;
