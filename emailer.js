module.exports = Emailer;

var ejs = require('ejs');
var fs = require('fs');

var nodemailer = require("nodemailer");

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP", {
	service: "Gmail",
	auth: {
		user: "gmail.user@gmail.com",
		pass: "userpass"
	}
});


var folder = 'emailtemplates/';

var Emailer = function(opts) {
	
};

Emailer.prototype.send = function(address, tempate, locals, cb) {
	makeTemplates(template, locals, function(templates) {
		var mailOptions = {
			from: "Outer Realm Hosting <support@outerrealmhosting.com>", // sender address
			to: address, // list of receivers
			subject: "Password Reset @ Outer Realm Hosting", // Subject line
			text: templates.text, // plaintext body
			html: templates.html // html body
		}

		smtpTransport.sendMail(mailOptions, function(error, response) {
			if (error) {
				console.log(error);
				cb(error);
			} else {
				console.log("Message sent: " + response.message);
				cb(null, response.message);
			}
		});
	});
};

var makeTemplates = function(name, locals, cb) {
	var output = {};

	var html = fs.readFileSync(folder + '/html/' + name + '.ejs', 'utf8');
	var text = fs.readFileSync(folder + '/text/' + name + '.ejs', 'utf8');
	render({
		html: html,
		text: text
	}, locals, function(templates) {
		return templates;
	});
};

var render = function(templates, locals, cb) {
	var done = {};
	done['html'] = ejs.render(templates.html, locals);
	done['text'] = ejs.render(templates.text, locals);
	cb(done);
};