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
for (i = 0; i < accountLoginInfos.length; i++) {
	clients[i] 	= new SteamUser();
	managers[i] = new TradeOfferManager({
		"steam": clients[i],
		"domain": "somedomain.com",
		"language": "en"
	});

	var pollDataFile = "polldata" + i + ".json"
	if (fs.existsSync(pollDataFile)) {
		managers[i].pollData = JSON.parse(fs.readFileSync(pollDataFile));
	}

	communities[i] = new SteamCommunity();

	clients[i].logOn({
		"accountName": accountLoginInfos[i][0],
		"password": accountLoginInfos[i][1],
		"twoFactorCode": SteamTotp.getAuthCode(accountLoginInfos[i][2])
	});

	clients[i].on("loggedOn", function() {
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

			console.log("Got API key: " + manager.apiKey);
		});

		community.setCookies(cookies);
		community.startConfirmationChecker(50000, "identitySecret" + i);
	});

	managers[i].on("newOffer", function(offer) {
		console.log("[" + offer.manager.steamID + "] Received offer with ID:" + offer.id + "." );
		if (offer.itemsToGive.length == 0) {
			offer.accept(function(err) {
				if (err) {
					console.log(">> [ERROR] Unable to accept offer: " + err.message);
				} else {
					communities[i].checkConfirmations();
					console.log(">> [NOTE] Offer accepted.")
				}
			});
		} else {
			console.log(">> [NOTE] Unable to accept offer:" + "Trade requests items.");
		}
	});

	managers[i].on("receivedOfferChanged", function(offer, oldState) {
		console.log("[" + offer.manager.steamID + "] Offer state change (" + offer.id + "): "
			+ TradeOfferManager.getStateName(oldState) + " -> "
			+ TradeOfferManager.getStateName(offer.state));

		if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
			offer.getReceivedItems(function(err, items) {
				if (err) {
					console.log(">> [ERROR] Could not get received items: " + err);
				} else {
					var names = items.map(function(item) {
						return item.name;
					});
					console.log(">> Received: " + names.join(", "));
				}
			});
		}
	});

	managers[i].on("pollData", function(pollData) {
		fs.writeFile("polldata.json", JSON.stringify(pollData));
	})
}
