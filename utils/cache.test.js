
var Cache = require('./cache');
var cache = new Cache(5);

console.log('功能测试...');
for (var i=0; i<10; i++){
	var key = 'A'+i;
	console.log('PUT', key, i);
	cache.put(key, i);
	console.log(cache);
}
console.log('PUT A9 0')
cache.put('A9', 0);
console.log(cache);

for (var i=0; i<10; i++){
	var key = 'A'+i;
	console.log('GET', key);
	console.log(key, cache.get('A'+i));
}

console.log('----------------------------------------')
console.log('Before',cache.keys_.toArray());
console.log('new size smaller than old size');
cache.capacity(3);
console.log('End', cache.keys_.toArray());
console.log('');

console.log('----------------------------------------');
console.log('Before',cache.keys_.toArray());
console.log('remove', 'A9');
cache.remove('A9');
console.log('End', cache.keys_.toArray());

console.log('clear');
console.log(cache.keys_.toArray());
while(!cache.isEmpty()){
	cache.lru();
	console.log(cache.keys_.toArray());
}

console.log('-----------------------------------------');
console.log('性能测试...');
var count = 1000000;
cache.capacity(count/100);
var keys = [];
console.log('create keys', count);
console.time('end');
for(var i=0; i<count; i++){
	keys.push('A'+i);
}
console.timeEnd('end');

console.log('Test for loop', count, ' times.')
console.time('put');

for (var i=0; i<count; i++){
	if (i<=3){
		console.log(i, cache);
	}
	cache.put(keys[i], i);
}
console.log('......');
console.timeEnd('put');

console.time('get');
for (var i=0; i<count; i++){
	cache.get(keys[i]);
}
console.timeEnd('get');