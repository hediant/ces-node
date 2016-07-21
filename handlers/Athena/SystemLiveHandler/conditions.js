var SysCmds = require('./commands');

function TriggerConditions(){
	this.sys_funcs_ = SysCmds;
	this.verbs_ = {
		"and" : function(left, right) { return left && right; },
		"or" : function(left, right) { return left || right; },
		"join" : function(left) { return (left); }
	};
	this.operators_ = {
		"===" : function (left, right) { return left === right; },
		"!==" : function (left, right) { return left !== right; },
		"==" : function (left, right) { return left == right; },
		"!=" : function (left, right) { return left != right; },
		">=" : function (left, right) { return left >= right; },
		"<=" : function (left, right) { return left <= right; },
		">" : function (left, right) { return left > right; },
		"<" : function (left, right) { return left < right; },
		"&" : function(left, right) { return left & right; },
		"|" : function(left, right) { return left | right; },
		"xor" : function(left, right) { return left ^ right; },
		"not" : function(left) {return !left; },
		"not_&" : function(left, right) { return !(left & right); },
		"not_|" : function(left, right) { return !(left | right); },
		"not_xor" : function(left, right) { return !(left ^ right); }
	};
}

module.exports = TriggerConditions;

//
// conditions - object
//
/*
	examples:

conditions = [
	{ // condition item
		verb : null, // "and" || "or" || null
		// condition exp
		exp : {
			left : { // token
				fn : "PV", // "PV" || "LASTVALUE" || "CHANGETO" || ... || null
				args : "5.3", 
			},
			op : "==",	// "===" || "!==" || "==" || "!=" || >=" || "<=" || ">" || "<" || "lamda"
			right : { // token
				fn : null,	// "PV" || "LASTVALUE" || ... || null
				args : 10
			}			
		}
	},
	{ // condition item
		verb : "or", // "and" || "or" || null
		// condition exp
		exp : {
			left : { // token
				fn : "PV", // "PV" || "LASTVALUE" || "CHANGETO" || ... || null
				args : ["5.2"], 
			},
			op : ">",	// "===" || "!==" || "==" || "!=" || >=" || "<=" || ">" || "<" || "lamda"
			right : { // token
				fn : null,	// "PV" || "LASTVALUE" || ... || null
				args : 11
			}			
		}
	},
	{ // condition item
		verb : "and", // "and" || "or" || null
		// condition exp
		exp : {
			left : { // token
				fn : null, // "PV" || "LASTVALUE" || "CHANGETO" || ... || null
				args : "5.2", 
			},
			op : "===",	// "===" || "!==" || "==" || "!=" || >=" || "<=" || ">" || "<" || "lamda"
			right : { // token
				fn : null,	// "PV" || "LASTVALUE" || ... || null
				args : 5.2
			}			
		}
	}	
];
*/
/*
	带嵌套结构的示意，如下：
	
	var conditions = [
		{ 
			verb : null, 
			exp : {
				left : { fn : "PV", args : [alarm.point_offset] },
				op : ">",
				right : { fn : null, args : alarm.params }			
			}
		},
		{
			verb:"join",
			exp : [
				{
					verb : null,
					exp : {
						left : { fn : "LASTVALUE",  args : [alarm.point_offset] },
						op : "<=",
						right : { fn : null, args : alarm.params }			
					}
				},
				{
					verb : "or",
					exp : {
						op : "not",
						left : { fn : "LASTVALUE",  args : [alarm.point_offset] }		
					}
				},								
			]
		}
	];
*/
TriggerConditions.prototype.parse = function(conditions) {
	var series_ = [], self = this;
	conditions.forEach(function(cond){
		if (cond.verb == "join"){
			series_.push({
				verb : self.verbs_.and,
				fn : self.parse(cond.exp)
			});
		}
		else {
			series_.push({
				verb : self.verbs_[cond.verb] || self.verbs_.and,
				fn : self.parse_expr(cond.exp)
			});
		}
	});

	this.exec_ = function(datasource) {
		if (!series_.length)
			return false;

		var ret = true, i = 0;
		do {
			ret = series_[i].verb(ret, series_[i++].fn(datasource));
		} while(i<series_.length);

		return ret;
	}

	return this.exec_;
};

TriggerConditions.prototype.parse_expr = function(exp) {
	var left_ = this.parse_token(exp.left)
		, op_ = this.operators_[exp.op]
		, right_ = this.parse_token(exp.right)
		, op_func_;

	if (op_) {
		op_func_ = function(datasource) {
			try {
				// 执行过程中存在的异常可能需要及时中断判断过程
				return op_(left_ && left_(datasource), right_ && right_(datasource));
			}
			catch(e){
				return false;
			}
		}
	}
	else{
		op_func_ = function(){ return false; };
	}

	return op_func_;
};

TriggerConditions.prototype.parse_token = function (token) {
	if (!token)
		return null;

	var fn_, args_ = token.args;	
	if (!token.fn){
		fn_ = function(){ return args_;	};
		return fn_;
	}

	var sys_fn_ = this.sys_funcs_[token.fn];
	if (!sys_fn_)
		throw SyntaxError("Unknown method: " + token.fn);

	if (typeof args_ === "undefined" || args_ == null) {
		fn_ = function(datasource) { return sys_fn_(datasource); };
	}
	else{
		if (Array.isArray(args_)) { // array
			switch (args_.length) {
				case 0:
					fn_ = function(datasource) { return sys_fn_(datasource); };
					break;
				case 1:
					fn_ = function(datasource){
						return sys_fn_(datasource, args_[0]);
					}
					break;
				case 2:
					fn_ = function(datasource){
						return sys_fn_(datasource, args_[0], args_[1]);
					}
					break;
				default:
					// slower
					fn_ = function(datasource){	
						args_.splice(0, 0, datasource);
						return sys_fn_.apply(arguments.callee, args_);
					}
			}
		}
		else{ // others
			fn_ = function(datasource) { return sys_fn_(datasource, args_); };
		}
	}

	return fn_;
};

TriggerConditions.prototype.setSysFunc = function(func_name, fn) {
	this.sys_funcs_[func_name] = fn;
};

TriggerConditions.prototype.getSysFunc = function(func_name) {
	return this.sys_funcs_[func_name];
};

TriggerConditions.prototype.match = function(datasource) {
	if (typeof this.exec_ !== "function")
		throw new Error("need parse conditions before call match function.");
	return this.exec_(datasource);
};
