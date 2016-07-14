function Link(){
	var first_ = {before:null};
	var tail_ = {before:first_, next : null};
	first_.next = tail_;

	var isEmpty = function(){
		return (first_.next == tail_ && tail_.before == first_ && 
				first_.before == null && tail_.next == null);
	};
	this.push = function(val){
		var node;
		if (isEmpty()){
			node = {v:val, next:tail_, before:first_}
			first_.next = node;
			tail_.before = first_.next;
		}
		else{
			node = {v:val, next:tail_, before:tail_.before}
			tail_.before.next = node;
			tail_.before = tail_.before.next;
		}
		return node;
	};
	this.shift = function(){
		var val = null;
		if (!isEmpty()){
			val = first_.next.v;

			first_.next = first_.next.next;
			first_.next.before = first_;
		}
		return val;
	};
	this.remove = function(node){
		node.before.next = node.next;
		node.next.before = node.before;
	};
	this.toArray = function(){
		var arr =[], cursor = first_.next;
		while(cursor != tail_){
			arr.push(cursor.v);
			cursor = cursor.next;
		}

		return arr;
	};
};

function Cache(capacity){

	console.assert(capacity>=0);

	// 为什么这里要专门写一个Link()链表类，而不是直接使用数组[]呢？
	// 因为，当this.keys_[]数组较大（如32位系统中10700）时，shift()函数
	// 会导致内存不断的重复alloc 2*N的空间，从而导致GC频繁的回收（因为新生代内存耗尽），
	// 这样，性能就会急剧下降。
	this.keys_ = new Link();

	this.size_ = 0;
	this.capacity_ = capacity;
	this.dic_ = {};
};
Cache.prototype = {
	get : function(key){
		var val = this.dic_[key];
		return (typeof val === 'undefined') ? null : val.v;
	},
	put : function(key, value){
		var dic = this.dic_, node;
		if (!this.isFull()){
			if (!dic.hasOwnProperty(key)){
				node = this.keys_.push(key);
				this.size_++;

				dic[key] = {v:value, n:node};
			}
			else{
				dic[key].v = value;
			}
		}
		else{
			// if isFull()
			if (dic.hasOwnProperty(key)){
				dic[key].v=value;
			}
			else{
				this.lru();
				this.put(key, value);				
			}
		}
	},
	isFull : function(){
		return this.size_ >= this.capacity_;
	},
	isEmpty : function(){
		return this.size_ == 0;
	},
	remove : function(key){
		var val = this.dic_[key];
		if (!(typeof val === 'undefined')){
			this.keys_.remove(val.n);
			delete this.dic_[key];

			this.size_--;
		}
	},
	lru : function(){
		// TODO
		// 实现LRU逻辑，这里只是简单的将keys链表第一个元素删除
		if (!this.isEmpty()){
			var key = this.keys_.shift();
			this.size_--;			

			delete this.dic_[key];
		}
	},
	capacity : function(n){
		console.assert(n>=0);
		if (n<this.capacity_){
			for(var i=0; i<this.capacity_-n;i++){
				this.lru();
			}
		}
		this.capacity_ = n;
	},
	keys : function(){
		return this.keys_.toArray();
	},
	size : function(){
		return this.size_;
	}
};

module.exports = Cache;