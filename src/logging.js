(function () {
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

    var createLogPath = function (level, username) {
        var logPath = path.join(shell.pwd().toString(), cfg.logging["logFilesRoot"]);
        shell.mkdir("-p", logPath);
        if (cfg.logging["separateAccountFolders"]) {
            logPath = path.join(logPath, username);
            shell.mkdir("-p", logPath);
            logPath = path.join(logPath, level + "_log.txt");
        } else {
            logPath = path.join(logPath, username + "_" + level + "_log.txt");
        }
        return logPath;
    };

    var createLogger = function (level, username) {
        // Define transports for logs.
        var datamine_transport = new winston.transports.File({
            name: "datamine",
            filename: createLogPath("datamine", username),
            timestamp: function () {
                return Date.now().toString() + "|" + new Date().format("HH:MM:ss dd.mm.yyyy");
            },
            json: false,
            formatter: function (opts) {
                return JSON.stringify({
                    "id": opts.message.substring(0, 11),
                    "receiving": opts.meta["receiving"],
                    "giving": opts.meta["giving"],
                    "state": opts.meta["state"],
                    "time": Date.now()
                });
            }
        });

        var console_transport = new winston.transports.Console({
            colorize: true,
            timestamp: function () {
                return new Date().format(cfg.dateFormats["console"]);
            },
            formatter: function (opts) {
                return opts.level.toUpperCase() + " " + opts.timestamp() + " -> " +
                    (undefined !== opts.message ? opts.message : "");
            }
        });

        // Create logger instance with transports.
        var logger = new winston.Logger({
            levels: {"error": 0, "success": 1, "regular": 2, "info": 3},
            transports: [datamine_transport, console_transport],
        });

        // Track loggers for every user.
        loggers[username] = logger;
        return logger;
    };

    module.exports.loggers = loggers;
    module.exports.winston = winston;
    module.exports.createLogger = createLogger;
}());
