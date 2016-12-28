(function () {
    const fs = require("fs");

    if (!fs.existsSync("config.json")) {
        console.log("Could not find 'config.json' file.");
        process.exit(1);
    }
    var configs = JSON.parse(fs.readFileSync("config.json"));

    module.exports.configs = configs;
    module.exports.accountLoginInfos = configs["accounts"];
    module.exports.accountNames = configs["accountNames"];
    module.exports.sounds = configs["sounds"];
    module.exports.logging = configs["logging"];
    module.exports.dateFormats = configs["dateFormats"];
}());
