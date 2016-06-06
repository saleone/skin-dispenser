const fs = require('fs');
const path = require("path");

require('date-util');
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const SteamTotp = require('steam-totp');
const shell = require("shelljs");
const winston = require("winston");

const configs = JSON.parse(fs.readFileSync('config.json'));
const accountLoginInfos = configs["accounts"];
const accountNames = configs["accountNames"];
const sounds = configs["sounds"];
const logging = configs["logging"];
const dateFormats = configs["dateFormats"];

winston.addColors({
	"error": "red",
	"success": "green",
	"regular": "blue",
	"info": "yellow"
});
var loggers = {};

var getOfferItems = function(offer) {
	var items = {"receiving": [], "giving": []};
	for (i = 0; i < offer.itemsToReceive.length; i++) {
		var itemPair = [offer.itemsToReceive[i].id, offer.itemsToReceive[i].market_name];
		items["receiving"].push(itemPair);	
	}
	for (i = 0; i < offer.itemsToGive.length; i++) {
		var itemPair = [offer.itemsToGive[i].id, offer.itemsToGive[i].market_name];	
		items["giving"].push(itemPair);
	}	
	return items;
}

var createLogPath = function(level, username) {
	var logPath = path.join(shell.pwd().toString(), logging["logFilesRoot"]);
 	shell.mkdir("-p", logPath);
	if (logging["separateAccountFolders"]) {
		logPath = path.join(logPath, username)
		shell.mkdir("-p", logPath);
		logPath = path.join(logPath, level + "_log.txt");
	} else {
		logPath  = path.join(logPath, username + "_" + level + "_log.txt");
	}
	return logPath;
}

var accountTradeHandler = function(username, password, sharedSecret) {
	var client 	= new SteamUser();
	var manager = new TradeOfferManager({
		"steam": client,
		"domain": "somedomain.com",
		"language": "en"
	});
	var community = new SteamCommunity();
	
	var logger = new winston.Logger({
		levels: {
			"error": 0,
			"success": 1,
			"regular": 2,
			"info": 3
		},
		transports: [
			new winston.transports.Console({
				colorize: true,
				timestamp: function() {
					return new Date().format(dateFormats["console"])
				},
				formatter: function(opts) {
					return opts.level.toUpperCase() + " " + opts.timestamp() + " -> " +
						(undefined !== opts.message ? opts.message : '')
				}
			}),
			new winston.transports.File({
				name: "datamine",
				filename: createLogPath("datamine", username),
				timestamp: function() {
					return Date.now().toString() + "|" + new Date().format(dateFormats["logFile"]);
				},
				json: false,
				formatter: function(opts) {
					var timeSplit = opts.timestamp().split("|");
					return JSON.stringify({
						"time" : timeSplit[0],
						"date": timeSplit[1],
						"severity": opts.level,
						"message": (opts.message !== undefined ? opts.message : ''),
						"items": opts.meta
					});
				}
			}),
			new winston.transports.File({
				name: "all",
				filename: createLogPath("all", username),
				timestamp: function() {
					return new Date().format(dateFormats["logFile"]);
				},
				json: false,
				formatter: function(opts) {
					return opts.level.toUpperCase() + " " + opts.timestamp() + " -> " +
						(undefined !== opts.message ? opts.message : '')
				}
			})
		]
	});
	loggers[username] = logger; 

	var pollDataFile = "polldata_" + username + ".json";
	if (fs.existsSync(pollDataFile)) {
		manager.pollData = JSON.parse(fs.readFileSync(pollDataFile));
	}

	client.logOn({
		"accountName": username,
		"password": password,
		"twoFactorCode": SteamTotp.getAuthCode(sharedSecret)
	});

	client.on("loggedOn", function() {
		winston.info("User " + (accountNames[this.steamID] || this.steamID)
			+ " successfully logged into Steam.");
	});

	client.on('webSession', function(sessionID, cookies) {
		manager.setCookies(cookies, function(err) {
			if (err) {
				console.log(err);
				process.exit(1);
				return;
			}
		});

		community.setCookies(cookies);
		community.startConfirmationChecker(50000, "identitySecret" + username);
	});

	manager.on("newOffer", function(offer) {
		account = accountNames[offer.manager.steamID] || offer.manager
		var offerItems = getOfferItems(offer);
		var logger = loggers[account];
		var message = account + " received an offer with ID: " + offer.id + ". ";
		if (offer.itemsToGive.length == 0) {
			offer.accept(function(err) {
				if (err) {
					logger.error(message + "Unable to accept offer: " + err.message, offerItems);
					if (fs.existsSync(sounds["errorOnDispense"])) {
						shell.exec("mplayer.exe " + sounds["errorOnDispense"], {"silent": true});
					}
				} else {
					community.checkConfirmations();
					logger.success(message + "Offer accepted.", offerItems);
					if (fs.existsSync(sounds["dispensed"])) {
						shell.exec("mplayer.exe " + sounds["dispensed"], {"silent": true});
					}
				}
			});
		} else {
			logger.regular(message + "Skiping offer:" + " Trade sender requests items.", offerItems);
			if (fs.existsSync(sounds["regularOffer"])) {
				shell.exec("mplayer.exe " + sounds["regularOffer"], {"silent": true} );
			}
		}
	});

	manager.on("receivedOfferChanged", function(offer, oldState) {
		account = accountNames[offer.manager.steamID] || offer.manager
		var logger = loggers[account];
		var offerItems = getOfferItems(offer);
		var message = account + "'s trade offer state changed (" + offer.id + "): "
			+ TradeOfferManager.getStateName(oldState) + " -> "
			+ TradeOfferManager.getStateName(offer.state);

		if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
			offer.getReceivedItems(function(err, items) {
				if (err) {
					message = message + " Could not get received items: " + err.message;
					logger.error(message, offerItems);
				} else {
					var names = items.map(function(item) {
						return item.name;
					});
					logger.success(message + " Received: " + names.join(", "), offerItems);
				}
			});
		}
	});

	manager.on("pollData", function(pollData) {
		fs.writeFile(pollDataFile, JSON.stringify(pollData));
	})
}

for (i = 0; i < accountLoginInfos.length; i++) {
	accountTradeHandler(accountLoginInfos[i][0], accountLoginInfos[i][1], accountLoginInfos[i][2]);
}
