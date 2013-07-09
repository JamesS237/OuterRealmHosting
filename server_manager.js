var streamS3 = require('connect-stream-s3');
var amazonS3 = require('awssum-amazon-s3');

var request = require('request');

var s3StreamMiddleware = streamS3({
	accessKeyId: process.env.ACCESS_KEY_ID,
	secretAccessKey: process.env.SECRET_ACCESS_KEY,
	awsAccountId: process.env.AWS_ACCOUNT_ID,
	region: amazonS3.US_EAST_1,
	bucketName: process.env.BUCKET_NAME,
	concurrency: 20
});

exports.s3Stream = s3StreamMiddleware;

var moment = require('moment');

var ec2 = require("ec2")({
	key: process.env.ACCESS_KEY_ID,
	secret: process.env.SECRET_ACCESS_KEY
});
var Connection = require('ssh2');
var ejs = require('ejs');

var Main = function(opts) {
	this.cdn = opts.cdn || 'cdn.outerrealmhosting.com';

	this.generate_tarball_url = function(a, b, c) {
		var tmp1 = this.server_types[a],
			tmp2 = tmp1[b],
			tmp3 = tmp2[c];
		return this.cdn + tmp3.url;
	};

	this.server_types = {
		vanilla: {
			feedthebeast: {
				ultimate: {
					url: '/tarball/vanilla/ultimate'
				},
				direwolf20: {
					url: '/tarball/vanilla/direwolf20'
				},
				mindcrack: {
					url: '/tarball/vanilla/mindcrack'
				},
				yogcraft: {
					url: '/tarball/vanilla/yogcraft'
				},
				rpgimmersion: {
					url: '/tarball/vanilla/rpgimmersion'
				},
				lite: {
					url: '/tarball/vanilla/lite'
				},
				ampz: {
					url: '/tarball/vanilla/ampz'
				},
				magicworld: {
					url: '/tarball/vanilla/magicworld'
				},
				techworld: {
					url: '/tarball/vanilla/techworld'
				},
				slowsstream: {
					url: '/tarball/vanilla/slowsstream'
				},
				retrosmp: {
					url: '/tarball/vanilla/retrosmp'
				},
				betapacka: {
					url: '/tarball/vanilla/betabacka'
				}
			},
			tekkit: {
				url: '/tarball/vanilla/tekkit'
			},
			vanilla: {
				url: '/tarball/vanilla/vanilla'
			}
		},
		bukkit: {
			feedthebeast: {
				ultimate: {
					url: '/tarball/bukkit/ultimate'
				},
				direwolf20: {
					url: '/tarball/bukkit/direwolf20'
				},
				mindcrack: {
					url: '/tarball/bukkit/mindcrack'
				},
				yogcraft: {
					url: '/tarball/bukkit/yogcraft'
				},
				rpgimmersion: {
					url: '/tarball/bukkit/rpgimmersion'
				},
				lite: {
					url: '/tarball/bukkit/lite'
				},
				ampz: {
					url: '/tarball/bukkit/ampz'
				},
				magicworld: {
					url: '/tarball/bukkit/magicworld'
				},
				techworld: {
					url: '/tarball/bukkit/techworld'
				},
				slowsstream: {
					url: '/tarball/bukkit/slowsstream'
				},
				retrosmp: {
					url: '/tarball/bukkit/retrosmp'
				},
				betapacka: {
					url: '/tarball/bukkit/betabacka'
				}
			},
			tekkit: {
				url: '/tarball/bukkit/tekkit'
			},
			vanilla: {
				url: '/tarball/bukkit/vanilla'
			}
		}
	};
	this.server_plans = {
		'jupiter': 'm2.xlarge',
		'saturn': 'm3.xlarge',
		'neptune': 'm1.xlarge',
		'venus': 'm1.large',
		'mars': 'm1.medium',
		'mercury': 'm1.small',
		'pluto': 't1.micro'
	};

	this.ami = 'ami-e995e380';
	this.key = 'outer_realm';

	this.overdue = {
		stop: stopOverdueServers,
		start: startOverdueServers
	};

	this.ip = null;
	this.owner = null;
	this.uuid = null;
	this.plan = null;

	this.instanceid = null;

	this.uuid = uuid(256);
	//this.backupFrequency = null;
};

Main.prototype.create =  function(opts, cb) {
	var user = options.account;
	this.owner = user;

	var plan = opts.plan;
	this.plan = plan;

	var endpoint = opts.endpoint || 'us-east-1';
	var paramaters = {
		ImageId: opts.ami || 'ami-e995e380',
		KeyName: opts.key,
		MinCount: 1,
		MaxCount: 1,
		InstanceType: opts.plan
	};
	ec2({
		endpoint: 'us-east-1'
	}, 'RunInstances', paramaters, function(err, res) {
		if (!err) {
			this.instanceid = res.instanceId;
			ec2({
				endpoint: 'us-east-1'
			}, 'AllocateAddress', {}, function(err, elastic_ip) {
				if (!err) {
					ec2({
						endpoint: 'us-east-1'
					}, 'AssociateAddress', {
						instanceId: res.instanceId,
						PublicIp: elastic_ip.publicIp
					}, function(err, resp) {
						cb(err, {
							instanceId: res.instanceId,
							publicIp: elastic_ip.publicIp
						});
					});
				} else {
					cb(err);
				}
			});
		} else {
			cb(err);
		}
	});
};

Main.prototype.install = function(opts, cb) {
	var keypair = opts.key;
	var user = 'ubuntu';
	var host = opts.publicIp;

	this.ip = host;

	var ops = opts.operators;
	var whitelist = opts.whitelist;

	var memory = opts.plan.allocatedMemory;

	var c = new Connection();

	c.on('connect', function() {
		console.log('Connected to server: ' + host);
	});

	c.on('ready', function() {
		async.waterfall([
			function(callback) {
				console.log('Installing Java Runtime');
				c.exec('sudo apt-get install openjdk-6-jre', function(err, stream) {
					if (err) throw err;
					stream.on('data', function(data, extended) {
						//console.log(data)
					});
					stream.on('end', function() {
						//console.log('Stream :: EOF');
					});
					stream.on('close', function() {
						//console.log('Stream :: close');
					});
					stream.on('exit', function(code, signal) {
						console.log('Java Runtime ' + (code !== 1 ? 'installed successfully' : 'failed!'));
						callback(code !== 1 ? null : new Error('Java was not installed successfully'));
						//c.end();
					});
				});
			},
			function(callback) {
				console.log('Grabbing server tarball');
				c.exec('wget -O server.tar.gz ' + this.generate_tarball_url(options.type), function(err, stream) {
					if (err) throw err;
					stream.on('data', function(data, extended) {
						//console.log(data)
					});
					stream.on('end', function() {
						//console.log('Stream :: EOF');
					});
					stream.on('close', function() {
						//console.log('Stream :: close');
					});
					stream.on('exit', function(code, signal) {
						console.log('Server tarball ' + (code !== 1 ? 'pulled successfully' : 'pull failed!'));
						if (code !== 1) {
							c.exec('tar -xvf server.tar.gz', function(err, stream_2) {
								if (err) throw err;
								stream_2.on('data', function(data, extended) {
									//console.log(data)
								});
								stream_2.on('end', function() {
									//console.log('Stream :: EOF');
								});
								stream_2.on('close', function() {
									//console.log('Stream :: close');
								});
								stream_2.on('exit', function(code, signal) {
									console.log('Server tarball ' + (code !== 1 ? 'extracted successfully' : 'failed to extract!'));
									callback(code !== 1 ? null : new Error('Unable to extract tarball'));
									//c.end();
								});
							});
						} else {
							callback(new Error('Could not get tarball'));
						}
						//c.end();
					});
				});
			},
			function(callback) {
				if (ops && ops.length > 0) {
					var str = ops.join('\r\n');
					c.exec("sudo echo '" + str + "' > /home/ubuntu/server/ops.txt", function(err, stream) {
						if (err) throw err;
						stream.on('data', function(data, extended) {
							//console.log(data)
						});
						stream.on('end', function() {
							//console.log('Stream :: EOF');
						});
						stream.on('close', function() {
							//console.log('Stream :: close');
						});
						stream.on('exit', function(code, signal) {
							console.log('Writing ops file ' + (code !== 1 ? 'completed successfully' : 'failed!'));
							callback(code !== 1 ? null : new Error('Could not write ops file'));
							//c.end();
						});
					});
				}
			},
			function(callback) {
				if (whitelist && whitelist.length > 0) {
					var str = whitelist.join('\r\n');
					c.exec("sudo echo '" + str + "' > /home/ubuntu/server/whitelist.txt", function(err, stream) {
						if (err) throw err;
						stream.on('data', function(data, extended) {
							//console.log(data)
						});
						stream.on('end', function() {
							//console.log('Stream :: EOF');
						});
						stream.on('close', function() {
							//console.log('Stream :: close');
						});
						stream.on('exit', function(code, signal) {
							console.log('Writing whitelist file ' + (code !== 1 ? 'completed successfully' : 'failed!'));
							callback(code !== 1 ? null : new Error('Could not write whitelist file'));
							//c.end();
						});
					});
				}
			},
			function(callback) {
				console.log('Creating billing job');
				c.exec("sudo echo '" + fs.readFileSync('chargeuser.js', 'utf8') + "' > /home/ubuntu/chargeuser.js", function(err, stream) {
						if (err) throw err;
						stream.on('data', function(data, extended) {
							//console.log(data)
						});
						stream.on('end', function() {
							//console.log('Stream :: EOF');
						});
						stream.on('close', function() {
							//console.log('Stream :: close');
						});
						stream.on('exit', function(code, signal) {
							console.log('Installing billing job ' + (code !== 1 ? 'completed successfully' : 'failed!'));
							callback(code !== 1 ? null : new Error('Could not install billing job'));
							//c.end();
						});
					});
			},
			function(callback) {
				console.log('Creating billing job');
				c.exec("sudo echo '" + fs.readFileSync('chargeuser.sh', 'utf8') + "' > /etc/cron.hourly/charge.sh", function(err, stream) {
						if (err) throw err;
						stream.on('data', function(data, extended) {
							//console.log(data)
						});
						stream.on('end', function() {
							//console.log('Stream :: EOF');
						});
						stream.on('close', function() {
							//console.log('Stream :: close');
						});
						stream.on('exit', function(code, signal) {
							console.log('Installing bill job ' + (code !== 1 ? 'completed successfully' : 'failed!'));
							callback(code !== 1 ? null : new Error('Could not install billing job'));
							//c.end();
						});
					});
			},
			function(callback) {
				console.log('Creating backup script');
				c.exec("sudo echo '" + fs.readFileSync('backupserver.js', 'utf8') + "' > /home/ubuntu/backupserver.js", function(err, stream) {
						if (err) throw err;
						stream.on('data', function(data, extended) {
							//console.log(data)
						});
						stream.on('end', function() {
							//console.log('Stream :: EOF');
						});
						stream.on('close', function() {
							//console.log('Stream :: close');
						});
						stream.on('exit', function(code, signal) {
							console.log('Installing backup script ' + (code !== 1 ? 'completed successfully' : 'failed!'));
							callback(code !== 1 ? null : new Error('Could not install backup script'));
							//c.end();
						});
					});
			},
			function(callback) {
				console.log('Installing node.js');
				c.exec('sudo apt-get update && sudo apt-get install python-software-properties python g++ make&& sudo add-apt-repository ppa:chris-lea/node.js&& sudo apt-get update&& sudo apt-get install nodejs&&sudo npm install request', function(err, stream) {
						if (err) throw err;
						stream.on('data', function(data, extended) {
							//console.log(data)
						});
						stream.on('end', function() {
							//console.log('Stream :: EOF');
						});
						stream.on('close', function() {
							//console.log('Stream :: close');
						});
						stream.on('exit', function(code, signal) {
							console.log('Installing node ' + (code !== 1 ? 'completed successfully' : 'failed!'));
							callback(code !== 1 ? null : new Error('Could not install node'));
							//c.end();
						});
				});
			},
			function(callback) {
				console.log('Creating backup job');
				c.exec("sudo echo '" + fs.readFileSync('cronjob.sh', 'utf8') + "' > /etc/cron.hourly/backup.sh", function(err, stream) {
						if (err) throw err;
						stream.on('data', function(data, extended) {
							//console.log(data)
						});
						stream.on('end', function() {
							//console.log('Stream :: EOF');
						});
						stream.on('close', function() {
							//console.log('Stream :: close');
						});
						stream.on('exit', function(code, signal) {
							console.log('Installing cron backup job ' + (code !== 1 ? 'completed successfully' : 'failed!'));
							callback(code !== 1 ? null : new Error('Could not install cron backup job'));
							//c.end();
						});
					});
			},
			function(callback) {
				console.log('Creating startup job');
				render(fs.readFileSync('startupjob.ejs', 'utf8'), {
					ram: memory
				}, function(err, job) {
					c.exec("sudo echo '" + job + "' > /etc/init/minecraft.conf", function(err, stream) {
						if (err) throw err;
						stream.on('data', function(data, extended) {
							//console.log(data)
						});
						stream.on('end', function() {
							//console.log('Stream :: EOF');
						});
						stream.on('close', function() {
							//console.log('Stream :: close');
						});
						stream.on('exit', function(code, signal) {
							console.log('Installing service ' + (code !== 1 ? 'completed successfully' : 'failed!'));
							callback(code !== 1 ? null : new Error('Could not install service'));
							//c.end();
						});
					});
				});
			},
			function(callback) {
				console.log('Starting server');
				c.exec('sudo start minecraft', function(err, stream) {
					if (err) throw err;
					stream.on('data', function(data, extended) {
						//console.log(data)
					});
					stream.on('end', function() {
						//console.log('Stream :: EOF');
					});
					stream.on('close', function() {
						//console.log('Stream :: close');
					});
					stream.on('exit', function(code, signal) {
						console.log('Starting minecraft server ' + (code !== 1 ? 'completed successfully' : 'failed!'));
						callback(code !== 1 ? null : new Error('Could not start server'), 'done');
						//c.end();
					});
				});
			}
		], function(err, result) {
			if (!err) {
				saveServer({
					uuid: this.uuid,
					ip: this.ip,
					owner: this.owner,
					plan: this.plan,
					instanceId: this.instanceId,
					running: true,
					allowedtoberun: true
				}, function(err, res) {
					if(!err) {
						cb(null);
					} else {
						cb(err);
					}
				});
			} else {
				cb(err);
			}
		});
	});

	c.connect({
		host: host,
		port: 22,
		username: user,
		privateKey: require('fs').readFileSync(keypair + '.pem')
	});
};

var render = function(str, opt, cb) {
	if (cb) cb(null, ejs.render(str, opts));
	return ejs.render(str, opts);
};

var saveServer = function(opts, cb) {
	var Server = require('./app').Server;
	var User = require('./app').User;
	var doc = new Server(opts);
	doc.save(function(err, doc) {
		//cb(err, doc);
		if(!err) {
			User.findOne({username:opts.username}, function(err, doc) {
				if(!err & doc) {
					var newArray = doc.servers;
					newArray.push(opts);
					User.update({username: opts.username}, {servers: newArray}, function(err, doc) {
						if(err) {
							cb(err);
						} else {
							cb(null);
						}
					});
				} else {
					cb(err);
				}
			});
		} else {
			cb(err);
		}
	});
};

var stopOverdueServers = function(opts, cb) {
	var Server = require('./app').Server;
	ec2({
		endpoint: 'us-east-1'
	}, 'StopInstances', {
		instanceId: opts.instanceId
	}, function(err, res) {
		if (!err) {
			Server.findOne({instanceId: opts.instanceId}, function(err, doc) {
				if(!err && doc) {
					Server.update(doc, {
						running: false,
						allowedtoberun: false
					}, function(err, aff) {
						if(!err) {
							cb(null);
						} else {
							cb(err);
						}
					});
				} else {
					cb(err);
				}
			});
		} else {
			cb(err);
		}
	});
};

var startOverdueServers = function(opts, cb) {
	ec2({
		endpoint: 'us-east-1'
	}, 'RunInstances', {
		instanceId: opts.instanceId
	}, function(err, res) {
		if (!err) {
			cb(null, res);
		} else {
			cb(err);
		}
	});
};

var uuid = function(l) {
	var a = '_!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
	var s = '';
	for(var i = 0; i < l; i++) {
		s += a.charAt(Math.floor(Math.random() * a.length));
	}
	return s.split('').reverse().join('');
};

module.exports = Main;