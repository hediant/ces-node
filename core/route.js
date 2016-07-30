exports.match = function (uri){
	var routes = config.routes;

	if (!Array.isArray(routes))
		return false;

	for (var i=0; i<routes.length; i++){
		if (routes[i].pattern.test(uri)){
			return {
				"uri" : uri,
				"handler" : routes[i].handler
			};
		}
	}

	return false;
}

var routeUri = function (topic, class_name){
	return class_name + "/" + topic;
}

exports.routeUri = routeUri;