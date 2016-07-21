////////////////////////////////////////////////////////////////////////////////////////////
//
// TO ALL OF METHOD IMPLEMENTS
//
// 注意：
// 		对于point不存在的情况是返回null还是应该中断当前判断过程？
// 		*早期的选择是后者，因为这样的判断是没有意义的，而错误的配置却可能导致left==right==null的这种情况
// 		*从而触发错误的trigger
//
// 		从这个版本开始后续是返回null(选择是前者)
// 		因为目前的约定是触发器不会开放，而采用null的处理逻辑上更完备些		
// 因此，
//		当遇到point不存在或者datasource错误时，将直接抛异常
//
////////////////////////////////////////////////////////////////////////////////////////////

/*
	datasource - object, 数据源
	{
		"fields" : {
			"field_1_name" : <object of Attribute>,
			"field_2_name" : <object of Attribute>,
			...
		},
		"status" : {
			"online" : 0 || 1
		}
	}	
*/

//
// 获得指定设备的某个属性的当前值
// 
exports.PV = function(datasource, field_name){
	try {
		var pv = datasource.fields[field_name].getValue();
	}
	catch(ex){
		return null;
	}
	
	if (typeof pv == "undefined")
		return null;

	return pv;
};

//
// 获得系统的当前在线状态
//
exports.ONLINE_STATUS = function (datasource){
	try {
		var online = datasource.status.online;
	}
	catch (ex){
		return 0;
	}

	return online;
}