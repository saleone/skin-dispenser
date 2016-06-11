(function() {
  const path = require("path");

  const winston = require("winston");
  const shell = require("shelljs");

  const cfg = require("./config_parser.js");

  winston.addColors({
    "error": "red",
    "success": "green",
    "regular": "blue",
    "info": "yellow"
  });

  var loggers = {};

  var createLogPath = function(level, username) {
    var logPath = path.join(shell.pwd().toString(), cfg.logging["logFilesRoot"]);
    shell.mkdir("-p", logPath);
    if (cfg.logging["separateAccountFolders"]) {
      logPath = path.join(logPath, username)
      shell.mkdir("-p", logPath);
      logPath = path.join(logPath, level + "_log.txt");
    } else {
      logPath  = path.join(logPath, username + "_" + level + "_log.txt");
    }
    return logPath;
  }

  var createLogger = function(level, username) {
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
            return new Date().format(cfg.dateFormats["console"])
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
            return Date.now().toString() + "|" + new Date().format(cfg.dateFormats["logFile"]);
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
            return new Date().format(cfg.dateFormats["logFile"]);
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
    return logger;
  };

  module.exports.loggers = loggers;
  module.exports.winston = winston;
  module.exports.createLogger = createLogger;
}());
