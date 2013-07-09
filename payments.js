var paypal = require('paypal-express-checkout');
var mongoose = require('mongoose');

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

var paymentSchema = mongoose.Schema({
	id: String,
	owner: String,
	price: Number,
	due: Date,
	description: String,
	paid: Boolean
});

var Payments = mongoose.model('Payments', paymentSchema);

var async = require('async');

var Main = function(options) {
	this.createBill = function(opts, cb) {
		var bill = new Payments({
			id: uuid(256),
			owner: opts.user,
			price: opts.price,
			due: new Date(new Date().getTime() + 2592000000),
			description: opts.description,
			paid: false
		});
		bill.save(cb);
	};

	this.pay = function(opts, cb) {
		var payment = paypal.init(opts.paypal.user, opts.paypal.pass, opts.paypal.signature, opts.paypal.return_url, opts.paypal.cancel_url);
		payment.pay(opts.order.number, opts.order.amount, opts.order.description, opts.order.currency || 'AUD', function(err, url) {
			cb(err, url);
		});
	};

	this.callback = function(opts, cb) {
		var token = opts.token;
		var payer = opts.payer;

		payment.detail(token, payer, function(err, data, invoiceNumber, price) {
			if (err) {
				cb(err);
				return;
			} else {
				cb(null, data);
			}
		});
	};

	this.findPayment = function(upid, cb) {
		Payments.findOne({
			id: upid
		}, function(err, res) {
			if (err) {
				cb(err);
			} else {
				if (res.paid) {
					//already paid!
					cb(null, true, null);
				} else {
					cb(null, null, res);
				}
			}
		});
	};

	this.finalize = function(opts, cb) {
		Payments.findOne({
			id: opts.id
		}).exec(function(err, doc) {
			if (!err) {
				Payments.update(doc, {
					paid: true
				}).exec(function(err, doc) {
					if (!err) {
						cb(null, doc);
					} else {
						cb(err);
					}
				});
			} else {
				cb(err);
			}
		});
	};

	this.paymentsOverdue = function(opts, cb) {
		var overdue = [];
		var Server = require('./app').Server;
		var ServerManager = require('./server_manager');
		var SM = new ServerManager();

		Payments.find({paid:false}).exec(function(err, res) {
			if(!res) {
				cb(null, []);
			} else {
				async.each(res, function(i, callback) {
					var c = new Date().getTime();
					var d = i.due.getTime();

					if(c-d > 2592000000) {
						//overdue.push(i);
						Server.find({owner: i.owner}, function(err, res) {
							async.each(res, function(i, callback1) {
								SM.overdue.stop({
									instanceId: i.instanceId
								}, function(err) {
									if(!err) {
										callback1();
									} else {
										callback1(err);
									}
								});
							}, function(err) {
								callback(err);
							});
						});
					} else {
						callback();
					}
				}, function(err) {
					cb(err, overdue);
				});
			}
		});
	};

	this.restartOverdueServers = function(opts, cb) {
		var Server = require('./app').Server;
		var ServerManager = require('./server_manager');
		var SM = new ServerManager();

		Server.find({
			owner: opts.owner,
			allowedtoberun: false
		}, function(err, res) {
			if (res) {
				async.each(res, function(i, callback) {
					Server.update(i, {
						allowedtoberun: true
					}, function(err, aff) {
						if (!err) {
							SM.overdue.start({
								instanceId: i.instanceId
							}, function(err, res) {
								if (err) {
									callback(err);
								} else {
									callback();
								}
							});
						} else {
							callback(err);
						}
					});
				}, function(err) {
					cb(err);
				});
			} else {
				cb(null);
			}
		});
	};
};

module.exports = Main;

var uuid = function(l) {
	var a = '_!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
	var s = '';
	for (var i = 0; i < l; i++) {
		s += a.charAt(Math.floor(Math.random() * a.length));
	}
	return s.split('').reverse().join('');
};