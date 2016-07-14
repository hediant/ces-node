/////////////////////////////////////////////////////////////////////
// 
function TaskCounter(count){
	this.task_times = [];
	for (var i=0; i<count; i++)
		this.task_times[i] = 0;
};
module.exports = TaskCounter;

TaskCounter.timeEnd = function(start, end){
	var msec = end.getMilliseconds() - start.getMilliseconds();
	var sec = end.getSeconds() - start.getSeconds();
	var min = end.getMinutes() - start.getMinutes();
	var hour = end.getHours() - start.getHours();

	return msec + sec*1000 + min*1000*60 + hour*1000*60*60;
};
TaskCounter.prototype.mean = function() {
	var array = this.task_times;
	var len = array.length;
	var sum = 0;
	for(var i=0; i<len; i++){
		sum += array[i];
	}
	return sum / len;
};
TaskCounter.prototype.showResult = function(predix) {
	var predix = (typeof predix === 'string') ? predix : '';

	console.log('-----------------------------------------------------------------');
	console.log(predix + ', preparing calc results.......');
	this.task_times.sort(function(value1, value2){
		if (value1 < value2)
			return -1;
		else if (value1 > value2)
			return 1;
		else
			return 0;
	});
	console.log('parse', this.task_times.length, 'requests. ');
	console.log('mean:', this.mean(), 'ms');
	console.log('min:', this.task_times[0], 'ms');
	console.log('max:', this.task_times[this.task_times.length-1], 'ms');
	console.log('90% <', this.task_times[
		(parseInt(this.task_times.length*0.9+1) <= this.task_times.length-1) ? 
		parseInt(this.task_times.length*0.9+1) : this.task_times.length-1],
		'ms');
	console.log('95% <', this.task_times[
		(parseInt(this.task_times.length*0.95+1) <= this.task_times.length-1) ? 
		parseInt(this.task_times.length*0.95+1) : this.task_times.length-1],
		'ms');
	console.log('99% <', this.task_times[
		(parseInt(this.task_times.length*0.99+1) <= this.task_times.length-1) ? 
		parseInt(this.task_times.length*0.99+1) : this.task_times.length-1],
		'ms');
	console.log('99.9% <', this.task_times[
		(parseInt(this.task_times.length*0.99+1) <= this.task_times.length-1) ? 
		parseInt(this.task_times.length*0.99+1) : this.task_times.length-1],
		'ms');	
	console.log('');
};
