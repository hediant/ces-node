module.exports = [
	{
		"pattern" : new RegExp("^bench\\d+"),
		"handler" : "Demo/BenchHandler"
	},
	{
		"pattern" : new RegExp(".*"),
		"handler" : "Demo/ExampleHandler"
	}
];