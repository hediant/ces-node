var Q = require('q');

module.exports = function (this_obj, cb_sytle_func){
	return {
		exec : function (){
			var args = Array.prototype.slice.call(arguments);
			return Q.Promise((resolve, reject) => {
				args.push(function (err, results){
					if (err)
						reject(err);
					else
						resolve(results);
				});

				cb_sytle_func.apply(this_obj, args);
			})
		}
	}
}