/**
 * Module dependencies.
 */

var monthly_prices = { //todo
	'm2.xlarge': 0,
	'm3.xlarge': 0,
	'm1.xlarge': 0,
	'm1.large': 0,
	'm1.medium': 0,
	'm1.small': 0,
	't1.micro': 0
};

var sm = require('./server_manager');
var Plans = new sm().server_plans;

var express = require('express'),
	http = require('http'),
	util = require('util'),
	path = require('path');

var moment = require('moment');

app.locals.fromNow = function(date) {
	return moment(date).fromNow();
};

app.locals.severType = function(type) {
	var a1 = type.split('.');
	for (var i = 0; i < a1.length; i++) {
		a1[i] = a1[i].capitalize();
	}
	var s = a1[0] + ': ' + a1[1] + (a1[2] ? ' ' + a1[2] : '');
	return s;
};

var severType = function(type) {
	var a1 = type.split('.');
	for (var i = 0; i < a1.length; i++) {
		a1[i] = a1[i].capitalize();
	}
	var s = a1[0] + ': ' + a1[1] + (a1[2] ? ' ' + a1[2] : '');
	return s;
};

String.prototype.capitalize = function() {
	var a = this.split('');
	a[0] = a[0].toUpperCase();
	return a.join('');
};

var app = express();
var server = http.createServer(app);

var io = require('socket.io').listen(server);

app.locals.title = "Outer Realm Hosting";
app.set('url', "outerrealmhosting.com");

var PaymentHandler = require('./payments');
var Payments = new PaymentHandler();

var PaypalAuthentication = {
	user: process.env.PAYPAL_USERNAME || '',
	pass: process.env.PAYPAL_PASSWORD || '',
	signature: process.env.PAYPAL_SIGNATURE || '',
	return_url: app.get('url') + '/acccount/bills/pay/callback',
	cancel_url: app.get('url') + '/acccount/bills/pay/cancelled'
};

var findOverduePayments = function(cb) {
	Payments.paymentsOverdue({
		//...
	}, cb || function() {});
};

setInterval(function() {
	findOverduePayments();
}, 60000);

var EventEmitter = require('events').EventEmitter;

var streamS3 = require('connect-stream-s3');
var amazonS3 = require('awssum-amazon-s3');

var s3StreamMiddleware = require('./server_manager').s3Stream;

var setS3ObjectName = function(req, res, next) {
	var date = moment().format('MMMM-Do-YYYY_h:mm:ss-a');
	if (req.files.file) {
		req.files.file.s3ObjectName = req.param('server') + '/' + date + '-' + req.files.file.name;
	}
	next();
};

var mongoose = require('mongoose');
var passport = require('passport');
var LocalStrategy = require("passport-local").Strategy;
var bcrypt = require("bcrypt-nodejs");
var SALT_WORK_FACTOR = 10;

var generate_mongo_url = function(obj) {
	obj.hostname = (obj.hostname || 'localhost');
	obj.port = (obj.port || 27017);
	obj.db = (obj.db || 'test');
	if (obj.username && obj.password) {
		return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
	} else {
		return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
	}
};

var mongourl = "mongodb://localhost/db";

mongoose.connect(mongourl);
var db = mongoose.connection;
db.on('error', function(err) {
	var e = err.toString();
	console.log('DB Connection '.red + e.red, 'error');
});
db.once('open', function callback() {
	console.log('Mongoose: '.red + 'Connected to DB'.green);
});

var serverSchema = mongoose.Schema({
	uuid: String,
	ip: String,
	owner: String,
	plan: String,
	instanceid: String,
	running: Boolean,
	allowedtoberun: Boolean
});

var Server = mongoose.model('Servers', serverSchema);

exports.Server = Server;

var paymentSchema = mongoose.Schema({
	id: String,
	owner: String,
	price: Number,
	due: Date,
	description: String,
	paid: Boolean
});

var paymentModel = mongoose.model('Payments', paymentSchema);

exports.PaymentsModel = paymentModel;

var passwordresetSchema = mongoose.Schema({
	id: String,
	user: String,
	expires: Date
});

var PasswordReset = mongoose.model('PasswordResets', passwordresetSchema);

var userSchema = mongoose.Schema({
	username: {
		type: String,
		required: true,
		unique: true
	},
	fullname: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true,
		unique: true
	},
	password: {
		type: String
	},
	location: {
		type: String,
		required: true
	},
	accessToken: {
		type: String
	}, // Used for Remember Me
	servers: [mongoose.Schema.Types.Mixed],
	isConfirmed: Boolean,
	uuid: String
});

// Bcrypt middleware
userSchema.pre('save', function(next) {
	var user = this;

	if (!user.isModified('password')) return next();

	bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
		if (err) return next(err);

		bcrypt.hash(user.password, salt,
			function() {
				//needed for some reason..?
			},
			function(err, hash) {
				if (err) return next(err);
				user.password = hash;
				next();
			});
	});
});

// Password verification
userSchema.methods.comparePassword = function(candidatePassword, cb) {
	bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
		if (err) return cb(err);
		cb(null, isMatch);
	});
};

// Remember Me implementation helper method
userSchema.methods.generateRandomToken = function() {
	var user = this,
		chars = "_!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
		token = new Date().getTime() + '_';
	for (var x = 0; x < 16; x++) {
		var i = Math.floor(Math.random() * 62);
		token += chars.charAt(i);
	}
	return token;
};

var User = mongoose.model('User', userSchema);
exports.User = User;

passport.serializeUser(function(user, done) {
	var createAccessToken = function() {
		var token = user.generateRandomToken();
		User.findOne({
			accessToken: token
		}, function(err, existingUser) {
			if (err) {
				return done(err);
			}
			if (existingUser) {
				createAccessToken(); // Run the function again - the token has to be unique!
			} else {
				user.set('accessToken', token);
				user.save(function(err) {
					if (err) return done(err);
					return done(null, user.get('accessToken'));
				});
			}
		});
	};

	if (user._id) {
		createAccessToken();
	}
});

passport.deserializeUser(function(token, done) {
	User.findOne({
		accessToken: token
	}, function(err, user) {
		done(err, user);
	});
});

passport.use(new LocalStrategy(function(username, password, done) {
	User.findOne({
		username: username
	}, function(err, user) {
		if (err) {
			return done(err);
		}
		if (!user) {
			return done(null, false, {
				message: 'Unknown user ' + username
			});
		}
		user.comparePassword(password, function(err, isMatch) {
			if (err) return done(err);
			if (isMatch) {
				return done(null, user);
			} else {
				return done(null, false, {
					message: 'Invalid password'
				});
			}
		});
	});
}));

function randStr(len) {
	var pos = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
	var arr = pos.split('');
	var out = '';
	for (var i = 0; i < len; i++) {
		out += arr[Math.floor(Math.random() * arr.length)];
	}
	return out;
}


// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());

app.use(app.router);
app.use(function(req, res, next) {
	if (req.method == 'POST' && req.url == '/login') {
		if (req.body.rememberme) {
			req.session.cookie.maxAge = 2592000000; // 30*24*60*60*1000 Rememeber me for 30 days
		} else {
			req.session.cookie.expires = false;
		}
	}
	next();
});
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

app.get('/', function(req, res) {
	res.render('index', {
		user: req.user
	});
});

var backup_auth = function() {
	return function(req, res, next) {
		if (req.param('auth') ==
			'CTVDIM4Px9I2nHllcnDfftzWGHei5Gp5yPjEru44x9fvzl1ImNzNf0aJ8YyjUaKO63yB1c7N!pjfS_bvG0Gh2s_Vwpt6oNNFaknQCIwSGLFBIvya019M1oSwrvoF_lXHIF3gKe_Mec060bhZJ5V7VDUbU5E9DaYuLRnvCkeJ079Pc_pXz7F5iLjryNBRiMzubrIf_JsahVFtQXZRR1QkZvIBhX18wz9HrD7W7JVq1_PzuQifCxACy24CY6uLs4aE'
		) {
			next();
		} else {
			res.writeHead(403, {
				'Content-Type': 'text/plain'
			});
			res.end('Not Allowed');
		}
	};
};

app.get('/tarball/:type/:pack', function(req, res) {
	res.sendFile(path.join(__dirname, 'servers/' + req.param('type') + '/' + req.param('pack') + '.tar.gz'));
});

app.get('/create', ensureAuthenticated, function(req, res) {
	res.render('create', {
		user: req.user
	});
});

app.post('/create', ensureAuthenticated, function(req, res) {
	var account = req.user;
	var plan = req.param('plan');
	var type = req.param('typea') + '.' + req.param('typeb') + req.param('typeb') == 'feedthebeast' ? (req.param('typec') !== "" ? '.' + req.param('type') : '') : ""; //format vanilla.feedthebeast.mindcrack
	var ops = req.param('ops');
	var whitelist = req.param('whitelist');

	var Creator = new createServer();

	Creator.create({
		plan: plan,
		ops: ops,
		whitelist: whitelist,
		type: type,
		account: account
	}, function(err, ip) {
		if (!err) {
			res.render('creating_server', {
				user: req.user
			});
		} else {
			res.json(500, {
				err: err
			});
		}
	});

	io.sockets.on('connection', function(socket) {
		Creator.on('progress', function(percent) {
			socket.emit('progress', {
				user: req.user.uuid,
				progress: percent
			});
		});

		Creator.on('status', function(status) {
			socket.emit('status', {
				user: req.user.uuid,
				status: status
			});
		});
	});
});

app.post('/backup/:server', backup_auth, setS3ObjectName, s3StreamMiddleware, function(req, res) {
	res.end('backup complete');
});

var calculatePrice = function(size) {
	return monthly_prices[Plans[size]];
};

app.post('/chargeuser/:uuid', backup_auth, function(req, res) {
	Servers.findOne({
		uuid: req.param('uuid')
	}).exec(function(err, doc) {
		var owner = doc.owner;
		var price = calculatePrice(doc.plan);
		var description = 'Server costs for server with IP: ' + doc.ip;
		Payments.createBill({
			user: owner,
			price: price,
			description: description
		}, function(err, res) {
			res.end('bill created');
		});
	});
});

app.get('/account/bills/alreadypaid', function(req, res) {
	res.render('alreadypaid', {
		user: req.user
	});
});

//payments
app.get('/account/bills/pay/:id', ensureAuthenticated, function(req, res) {
	Payments.findPayment(req.param('id'), function(err, paid, bill) {
		if (paid) {
			res.redirect('/account/bills/alreadypaid');
		} else {
			Payments.pay({
				paypal: PaypalAuthentication,
				order: {
					number: bill.id,
					amount: bill.amount,
					description: bill.amount
				}
			}, function(err, url) {
				if (err) {
					//do something
				} else {
					res.redirect(url);
				}
			});
		}
	});
});

app.get('/acccount/bills/pay/callback', ensureAuthenticated, function(req, res) {
	if (req.param('token') && req.param('PayerId')) {
		Payments.callback({
			token: req.param('token'),
			payer: req.param('PayerId')
		}, function(err, data, invoiceid, price) {
			if (!err) {
				Payments.finalize({
					id: payment_id //todo
				}, function(err, affected) {
					if (!err) {
						Payments.restartOverdueServers({
							owner: req.user
						}, function(err) {
							if (!err) {
								res.render('billpaid', {
									user: req.user,
									purchase: {
										price: price,
										invoiceid: invoiceid
									}
								});
							} else {
								res.render('500', {
									user: res.user
								});
							}
						});
					} else {
						res.render('500', {
							user: res.user
						});

					}
				});
			} else {
				res.render('500', {
					user: res.user
				});
			}
		});
	} else {
		res.render('500', {
			user: res.user
		});
	}
});

app.get('/acccount/bills/pay/cancelled', ensureAuthenticated, function(req, res) {
	res.render('paymentcancelled', {
		user: req.user
	});
});

//Auth Routes
app.get('/changepassword', ensureAuthenticated, function(req, res) {
	res.render('changepassword', {
		user: req.user
	});
});

app.post('/changepassword', ensureAuthenticated, function(req, res) {
	User.findOne({
		username: req.user.username
	}).exec(function(err, doc) {
		doc.password = req.param('new_password');
		doc.save(function(err, doc) {
			if (!err) {
				req.logout();
				res.redirect('/login');
			} else {
				res.render('500', {
					user: req.user
				});
			}
		});
	});
});

app.get('/forgotpassword', ensureNotAuthenticated, function(req, res) {
	var err = req.param('err');
	res.render('forgotpassword', {
		err: err
	});
});

app.post('/forgotpassword', function(req, res) {
	var username = req.param('username');
	var email = req.param('email');

	User.findOne({
		username: username,
		email: email
	}, function(err, res) {
		if (!err && doc) {
			sendResetEmail(username, email, function(err) {
				if (!err) {
					res.render('forgotpassword_sent', {
						//
					});
				} else {
					res.render('500');
				}
			});
		} else {
			res.redirect('/forgotpassword?err=unknown');
		}
	});
});

app.get('/resetpass/:id', function(req, res) {
	PasswordReset.findOne({
		id: req.param('id')
	}, function(err, doc) {
		if (!err) {
			res.render('resetpass', {
				id: req.param('id')
			});
		} else {
			res.render('500', {});
		}
	});
});

app.post('/resetpass/:id', function(req, res) {
	PasswordReset.findOne({
		id: req.param('id')
	}, function(err, doc) {
		if (!err) {
			User.findOne({
				username: doc.username
			}, function(err, doc) {
				doc.password = req.param('new_password');
				doc.save();
				PasswordReset.remove({
					id: req.param('id')
				}, function(err, asdf) {
					res.redirect('/login?recovered=true');
				});
			});
		} else {
			res.render('500', {});
		}
	});
});

app.get('/confirmaccount/:id', function(err, res) {
	User.findOne({
		isConfirmed: false,
		confirmCode: req.param('id')
	}, function(err, doc) {
		if (!err && doc) {
			User.update(doc, {
				isConfirmed: true
			}, function(err, aff) {
				if (!err) {
					res.redirect('/login?confirmed=true');
				} else {
					res.render(500);
				}
			});
		} else {
			res.render(500);
		}
	});
});

app.get('/account', ensureAuthenticated, function(req, res) {
	PaymentsModel.find().exec(function(err, docs) {
		res.render('account', {
			user: req.user,
			bills: docs || []
		});
	});
});

app.get('/login', function(req, res) {
	req.session.messages = req.param('to');
	var isNew = false;
	if (req.param('new') == 1) {
		isNew = true;
	}
	res.render('login', {
		user: req.user,
		locations: require('./locations.json').locations,
		message: req.session.messages,
		isNew: isNew,
		recovered: req.param('recovered'),
		confirmed: req.param('confirmed')
	});
	req.session.messages = null;
});

app.post('/login', function(req, res, next) {
	var to = req.session.to;
	passport.authenticate('local', function(err, user, info) {
		if (err) {
			return next(err);
		}
		if (!user) {
			req.session.messages = [info.message];
			return res.redirect('/login');
		}
		if (!user.isConfirmed) {
			req.session.messages = ['Please check your email, and confirm your account'];
			return res.redirect('/login');
		}
		req.logIn(user, function(err) {
			if (err) {
				return next(err);
			}
			req.session.messages = null;
			return res.redirect(to || '/');
		});
	})(req, res, next);
});

app.get('/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});

app.get('/register', function(req, res) {
	var taken = {
		username: false,
		email: false
	};
	if (req.param('err') == 2) {
		taken = {
			username: false,
			email: true,
			invalidEmail: false
		};
	} else if (req.param('err') == 3) {
		taken = {
			username: true,
			email: false,
			invalidEmail: false
		};
	} else if (req.param('err') == 5) {
		taken = {
			username: false,
			email: false,
			invalidEmail: true
		};
	}
	res.render('register', {
		user: req.user,
		locations: require('./locations.json').locations,
		message: req.session.messages,
		error: false,
		taken: taken
	});
});

app.post('/register', function(req, res) {
	var username = req.param('username');
	var password = req.param('password');
	var email = req.param('email');
	var location = req.param('herolist');
	var fullname = req.param('fullname');
	var confirmCode = uuid(256);
	if (username === null || password === null || email === null || fullname === null || location === null || username === "" || password === "" || email === "" || location === "" || fullname === "") {
		res.redirect('/register?err=4');
	} else if (!validateEmail(email)) {
		res.redirect('/register?err=5');
	} else {
		var usr = new User({
			username: username,
			email: email,
			password: password,
			location: location,
			fullname: fullname,
			servers: [],
			isConfirmed: false,
			confirmCode: confirmCode,
			uuid: uuid(512)
		});
		usr.save(function(err) {
			if (err) {
				console.log(err.key);
				if (err && err.code == 11000) {
					if (JSON.stringify(err).toString().indexOf('username') > -1) {
						res.redirect('/register?err=3');
					} else if (JSON.stringify(err).toString().indexOf('email') > -1) {
						res.redirect('/register?err=2');
					}
				}
			} else {
				console.log('user: ' + usr.username + " saved.");
				sendConfirmEmail(email, confirmCode, username, function(err) {
					if (!err) {
						res.redirect('/login?new=1');
					} else {
						res.render('500');
					}
				});
			}

		});
	}
});

server.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});

var ramSizes = {
	'm2.xlarge': 17300,
	'm3.xlarge': 15360,
	'm1.xlarge': 15300,
	'm1.large': 7600,
	'm1.medium': 3800,
	'm1.small': 1700,
	't1.micro': 600
};

var createServer = function() {
	var SM = require('./server_manager');
	var ServerManager = new SM({
		cdn: 'outerrealmshosting.com'
	});

	this.create = function(options, callback) {
		ServerManager.create({
			endpoint: 'us-east-1',
			ami: 'ami-e995e380',
			plan: ServerManager.server_plans[options.plan],
			key: 'outerrealm',
			account: options.account
		}, function(err, res) {
			this.emit('progress', 50);
			this.emit('status', err || 'Done creating server, now installing Minecraft!');
			ServerManager.install({
				key: 'outerrealm',
				publicIp: res.publicIp,
				plan: {
					allocatedMemory: ramSizes[ServerManager.server_plans[options.plan]]
				},
				operators: options.ops || [],
				whitelist: options.whitelist || [],
				type: options.type
			}, function(err) {
				if (!err) {
					this.emit('progress', 100);
					this.emit('status', 'Done installing Minecraft. Server is now ready to play!');
					callback(null, res.publicIp);
				} else {
					this.emit('status', err);
					callback(err);
				}
			});
		});
	};
};

util.inherits(createServer, EventEmitter);

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.redirect('/login?to=' + req.url);
}

function ensureNotAuthenticated(req, res, next) {
	if (!req.isAuthenticated()) {
		return next();
	}
	res.redirect('/');
}

function sendResetEmail(username, email, cb) {
	var id = uuid(128);
	var doc = PasswordReset({
		expires: new Date(new Date().getTime() + 7200000),
		id: id,
		user: username
	});
	doc.save(function(err, doc) {
		if (err) {
			cb(err);
		} else {
			var email = require('./emailer');
			var Emailer = new email();
			Emailer.send(email, 'resetPassword', {
				username: username,
				link: '/resetpass/' + id
			}, function(err) {
				cb(err);
			});
		}
	});
}

function sendConfirmEmail(email, code, username, cb) {
	var emailer = require('./emailer');
	var Emailer = new emailer();

	Emailer.send(email, 'confirmAccount', {
		username: username,
		link: '/confirmaccount/' + code
	}, function(err) {
		cb(err);
	});
}

var uuid = function(l) {
	var a = '_!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
	var s = '';
	for (var i = 0; i < l; i++) {
		s += a.charAt(Math.floor(Math.random() * a.length));
	}
	return s.split('').reverse().join('');
};