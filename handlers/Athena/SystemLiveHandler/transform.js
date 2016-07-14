var valid_data = require('./valid_data');

module.exports = function(profile, fields){
	// if profile not exist, we just return
	if (!profile || !profile.tags){
		return;
	}

	for (var tag_id in profile.tags){
		var tag = profile.tags[tag_id];
		var val = fields.data[tag_id];
		
		if (tag.type != "Analog")
			continue;

		if (isNaN(tag.scale) || isNaN(tag.deviation))
			continue;
		
		if (valid_data(val) && !isNaN(val) && (typeof val != 'boolean')){
			fields.data[tag_id] = val * tag.scale + tag.deviation;
		}		
	}
};
