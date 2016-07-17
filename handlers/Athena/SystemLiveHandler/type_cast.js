module.exports = function (val, type){
	switch (type){
		case "NUMBER":
			return Number(val);
		case "INTEGER":
			return parseInt(val);
		case "BOOLEAN":
			return Boolean(val);
		case "STRING":
		case "LOCATION":
		case "DATETIME":
		default :
			return val;
	}
};