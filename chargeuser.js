#!/usr/bin/env node

var spawn = require('child_process').spawn;
var http = require('http');
var fs = require('fs');

var request = require('request');

var token = 'CTVDIM4Px9I2nHllcnDfftzWGHei5Gp5yPjEru44x9fvzl1ImNzNf0aJ8YyjUaKO63yB1c7N!pjfS_bvG0Gh2s_Vwpt6oNNFaknQCIwSGLFBIvya019M1oSwrvoF_lXHIF3gKe_Mec060bhZJ5V7VDUbU5E9DaYuLRnvCkeJ079Pc_pXz7F5iLjryNBRiMzubrIf_JsahVFtQXZRR1QkZvIBhX18wz9HrD7W7JVq1_PzuQifCxACy24CY6uLs4aE';


var uuid = function() {
	return fs.readFileSync('/home/ubuntu/uuid.txt', 'utf8 ');
};

var backup = function(filename, cb, url) {
	fs.createReadStream(filename).pipe(request.post(url ? url : 'http://outerrealmhosting.com/chargeuser/' + uuid() + '?auth=' + token));
};

var main = function() {
	var file;
	var url;
	if(process.argv.indexOf('-f') > -1) {
		file = process.argv[process.argv.indexOf('-f') + 1];
	}
	if(process.argv.indexOf('-u') > -1) {
		url = process.argv[process.argv.indexOf('-u') + 1];
	}
	backup(file ? file : 'backup.tar.gz', function() {
		process.exit(0);
	}, url ? url : null);
};

main();