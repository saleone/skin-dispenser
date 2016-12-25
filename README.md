# Skin Dispenser Browserless

Port of user script which tries to accept all empty trade offers to node.js
application.

## Installation
To run the script you will need to:
* Install [node.js](https://nodejs.org) for your platform.
* Update Node Package Manager with ```npm install npm -g```.
* Install ```steam-tradeoffer-manager```, ```steam-user```, ```date-util```,
```winston``` ```fifo``` and ```shelljs``` packages with ```npm```.
* Above can be achieved just by running ```npm install``` in root folder.
* Configure your ```config.json``` (example in [config.json](./src/config.json)).
* Run ```app.js``` with ```node```.

## Sound notifications
As you can see in the configuration file you can set the audio files that are
played when certain offer comes. Recently mplayer.exe was in the repository
and it was used to play the sounds, but now you need to manually download
[Mplayer](https://www.mplayerhq.hu/design7/news.html) binary and put it with
`app.js` (NOTE: binary should be called `mplayer.exe`). Another option is to
manually change the line that calls the player in `playSound()` function.

## License
All versions of Skin Dispenser Browserless are released under the terms of
[GNU GPLv3](./LICENSE).
