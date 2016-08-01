module.exports = [
	{
		"pattern" : new RegExp("^demo/\.+"),
		"handler" : "Demo/ExampleHandler"
	},
	{
		"pattern" : new RegExp("^demo.bench/\.+"),
		"handler" : "Demo/BenchHandler"
	},
	{
		"pattern" : new RegExp("^demo.seq.bench/\.+"),
		"handler" : "Demo/ForSequenceTestHandler"
	}
]