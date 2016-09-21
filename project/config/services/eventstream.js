module.exports = {
	stream_server : {
		url : "amqp://localhost",
		options : {
			exchange : "EventStreamExchange"
		}
	},
	max_len : 1000,
	max_time_to_fire : 10
}