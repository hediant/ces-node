function Queue(){
	var first_ = {next : null};
	var tail_ = {before: first_, next:null}; first_.next = tail_;
	var len_ = 0;

	var isEnd = function(node){
		return (node.next == tail_);
	};
	var isEmpty = function(){
		return first_.next == tail_;
	}
	this.push = function(val){
		var node = {v:val, next:tail_};
		tail_.before.next = node;
		tail_.before = node;
	};
	this.toArray = function(){
		var arr =[], cursor = first_.next;
		while(cursor != tail_){
			arr.push(cursor.v);
			cursor = cursor.next;
		}
		return arr;
	};
	this.forEach = function(callback){
		var cursor = first_.next;
		while(cursor != tail_){
			callback(cursor.v);
			cursor = cursor.next;
		}
	};
	this.clear = function(){
		first_ = {next : tail_};
		tail_ = {before: first_, next:null};
		len_ = 0;
	}
};
module.exports = Queue;