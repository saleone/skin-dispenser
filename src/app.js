const fs = require('fs');
const path = require('path');

require('date-util');
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const SteamTotp = require('steam-totp');
const shell = require('shelljs');

const cfg = require('./config_parser');
const log = require('./logging');
const storage = require('./offer_storage');

var getOfferItems = function (offer) {
  var items = {
    "receiving": [],
    "giving": []
  };
  for (i = 0; i < offer.itemsToReceive.length; i++) {
    items["receiving"].push(offer.itemsToReceive[i].market_name);
  }

  for (i = 0; i < offer.itemsToGive.length; i++) {
    items["giving"].push(offer.itemsToGive[i].market_name);
  }
  return items;
}

var playSound = function (soundType) {
  if (fs.existsSync(cfg.sounds[soundType])) {
    shell.exec("mplayer.exe " + cfg.sounds[soundType], {
      "silent": true
    });
  }
}

var accountTradeHandler = function (username, password, sharedSecret) {
  var client = new SteamUser();
  var manager = new TradeOfferManager({
    "steam": client,
    "domain": "somedomain.com",
    "language": "en"
  });
  var community = new SteamCommunity();

  var logger = log.createLogger("all", username);

  polldataDir = "polldata/";
  if (!fs.exists(polldataDir)) {
    shell.mkdir("-p", polldataDir);
  }
  var pollDataFile = path.join(polldataDir, username + "_polldata.json");
  if (fs.existsSync(pollDataFile)) {
    manager.pollData = JSON.parse(fs.readFileSync(pollDataFile));
  }

  client.logOn({
    "accountName": username,
    "password": password,
    "twoFactorCode": SteamTotp.getAuthCode(sharedSecret)
  });

  client.on("loggedOn", function () {
    log.winston.info("User " + (cfg.accountNames[this.steamID] || this.steamID) +
      " successfully logged into Steam.");
  });

  client.on('webSession', function (sessionID, cookies) {
    manager.setCookies(cookies, function (err) {
      if (err) {
        console.log(err);
        process.exit(1);
        return;
      }
    });

    community.setCookies(cookies);
    community.startConfirmationChecker(50000, "identitySecret" + username);
  });

  manager.on("newOffer", function (offer) {
    account = cfg.accountNames[offer.manager.steamID] || offer.manager
    var offerItems = getOfferItems(offer);
    var message = account + " received an offer with ID: " + offer.id + ". ";
    if (offer.itemsToGive.length == 0) {
      offer.accept(function (err) {
        if (err) {
          storage.push(offer);
          logger.error(message + "Unable to accept offer: " + err.message, offerItems);
          playSound("errorOnDispense");
        } else {
          community.checkConfirmations();
          logger.success(message + "Offer accepted.", offerItems);
          playSound("dispensed");
        }
      });
    } else {
      logger.regular(message + "Skiping offer:" + " Trade sender requests items.", offerItems);
      playSound("regularOffer");
    }
  });

  manager.on("receivedOfferChanged", function (offer, oldState) {
    account = cfg.accountNames[offer.manager.steamID] || offer.manager
    var offerItems = getOfferItems(offer);
    var message = account + "'s trade offer state changed (" + offer.id + "): " +
      TradeOfferManager.getStateName(oldState) + " -> " +
      TradeOfferManager.getStateName(offer.state);

    if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
      offer.getReceivedItems(function (err, items) {
        if (err) {
          message = message + " Could not get received items: " + err.message;
          logger.error(message, offerItems);
        } else {
          var names = items.map(function (item) {
            return item.name;
          });
          logger.success(message + " Received: " + names.join(", "), offerItems);
        }
      });
    } else {
      logger.regular(message);
    }
  });

  manager.on("pollData", function (pollData) {
    fs.writeFile(pollDataFile, JSON.stringify(pollData));
  })
}

for (i = 0; i < cfg.accountLoginInfos.length; i++) {
  accountTradeHandler(cfg.accountLoginInfos[i][0], cfg.accountLoginInfos[i][1], cfg.accountLoginInfos[i][2]);
}