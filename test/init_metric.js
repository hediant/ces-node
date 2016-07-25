var LobsterClient = require('../../common/lobster_client')
	, assert = require('assert');

var metrics = [
	{
		"name" : "test.metric",
		"desc" : "",
		"ver" : 0,
		"keys" : [
			{
				"name" : "abc",
				"type" : "NUMBER"
			},
			{
				"name" : "abd",
				"type" : "NUMBER"
			}
		]
	}
];

var client = new LobsterClient();

describe("create " + metrics[0].name, function(){
	it("should without error", function(done){
		client.createMetric(metrics[0], function (err){
			assert(!err || err.code == "ER_METRIC_EXIST");
			done();
		})
	});
});