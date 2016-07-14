module.exports = function(val) {
	return (typeof val !== "undefined" && val !== null && val !== NaN);
};