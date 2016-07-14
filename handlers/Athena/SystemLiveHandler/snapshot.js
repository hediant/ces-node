var valid_data = require('./valid_data');
var Topic = require('../../../../common/topics');

module.exports = function (service, system_tags, topic, fields, cb) {
	var system_id = Topic.systemUuid(topic);
	if (!system_id || !system_tags){
		cb (null);
		return;
	}

	// 如果快照服务有效则执行快照
	if (!service || !service.isEnabled()) {
		// 如果snapshot服务不可用，是应该继续后面的处理流程（如保存历史，触发报警等）
		// 还是应该返回error，终止EventHandler呢？
		// 当前的做法是继续后面的处理流程。
		cb (null);
		return;
	}	

	// 如果不存在有效的TAG_ID，则直接返回，不做任何处理
	if (!Object.keys(fields.data).length) {
		cb && cb();
		return;
	}

	// 如果存在有效的TAG_ID，则对其做快照
	service.setSystemValues(system_id, {
			data : fields.data,
			recv : fields.recv,
			source : fields.source,
			quality : fields.quality
		}, function(err, ret) {
			// MUST CALLBACK
			cb && cb(err);
		}
	);
};