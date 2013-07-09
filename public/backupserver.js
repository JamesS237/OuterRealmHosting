#!/usr/bin/env node

var args = process.argv;
var spawn = require('child_process').spawn;
var http = require('http');
var fs = require('fs');

//
//cp /home/ubuntu/server /tmp/backup/server
//cd /tmp/backup
//tar -czf backup.tar.gz server/
//backupserver -f /tmp/backup/backup.tar.gz
//sudo rm -rf /tmp/backup
//
//

var backup = function(filename, cb, url) {
	fs.createReadStream(filename).pipe(request.post(url ? url : 'http://localhost:2000'));
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