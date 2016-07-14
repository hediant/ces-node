module.exports = function (tag, data){
	var val = data[tag.name];
	switch (tag.type){
		case "Enumeration":
		case "Digital":
			return Math.floor(val);
		case "Analog":
			return Number(val);
		case "String":
			return val ? String(val) : "";
		case "Object":
			try {
				return JSON.parse(val);
			}
			catch(e){
				return null;
			}
		case "Buffer":
		case "Array":
		case "Date":
		default :
			return null;
	}
};