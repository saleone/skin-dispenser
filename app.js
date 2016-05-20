var TradeOfferManager = require('steam-tradeoffer-manager');
var SteamUser = require('steam-user');
var SteamCommunity = require('steamcommunity');
var SteamTotp = require('steam-totp')
var fs = require('fs')

var configs = JSON.parse(fs.readFileSync('config.json'))
var accountLoginInfos = configs["accounts"];
var accountNames = configs["accountNames"];

var clients 	= [];
var managers 	= [];
var communities = [];

var accountTradeHandler = function(username, password, sharedSecret) {
	var client 	= new SteamUser();
	var manager = new TradeOfferManager({
		"steam": client,
		"domain": "somedomain.com",
		"language": "en"
	});
	var community = new SteamCommunity();

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
		console.log("[NOTE] User " + (accountNames[this.steamID] || this.steamID)
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
		console.log("\n[OFFER] " + account + " received an offer with ID: " + offer.id + "." );
		if (offer.itemsToGive.length == 0) {
			offer.accept(function(err) {
				if (err) {
					console.log("  >> [ERROR] Unable to accept offer: " + err.message);
				} else {
					community.checkConfirmations();
					console.log("  >> [DONE] Offer accepted.")
				}
			});
		} else {
			console.log("  >> [NOTE] Unable to accept offer:" + " Trade sender requests items.");
		}
	});

	manager.on("receivedOfferChanged", function(offer, oldState) {
		account = accountNames[offer.manager.steamID] || offer.manager
		console.log("\n[OFFER] " + account + "'s trade offer state changed (" + offer.id + "): "
			+ TradeOfferManager.getStateName(oldState) + " -> "
			+ TradeOfferManager.getStateName(offer.state));

		if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
			offer.getReceivedItems(function(err, items) {
				if (err) {
					console.log("  >> [ERROR] Could not get received items: " + err);
				} else {
					var names = items.map(function(item) {
						return item.name;
					});
					console.log("  >> [DONE] Received: " + names.join(", "));
				}
			});
		}
	});

	manager.on("pollData", function(pollData) {
		fs.writeFile(pollDataFile, JSON.stringify(pollData));
	})

	clients.push(client);
	managers.push(manager);
	communities.push(community);
}

for (i = 0; i < accountLoginInfos.length; i++) {
	accountTradeHandler(accountLoginInfos[i][0], accountLoginInfos[i][1], accountLoginInfos[i][2]);
}
