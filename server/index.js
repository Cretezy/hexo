require('dotenv').config();

const nodeshout = require("nodeshout");
const express = require("express");
const path = require("path");
const EventEmitter = require('events');


// Setup nodeshout
nodeshout.init();

const shout = nodeshout.create();

shout.setHost(process.env.ICECAST_HOST);
shout.setPort(process.env.ICECAST_PORT);
shout.setUser(process.env.ICECAST_USER);
shout.setPassword(process.env.ICECAST_PASS);
shout.setMount(process.env.ICECAST_MOUNT);
shout.setFormat(1); // 0=ogg, 1=mp3
shout.setAudioInfo('bitrate', '128');
shout.setAudioInfo('samplerate', '44100');
shout.setAudioInfo('channels', '2');

if (shout.open() !== 0) {
    console.log("Could not connect")
}


const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const state = {
    shout,
    app,
    io,
    events: new EventEmitter(),
};
require('./songs')(state);
require('./socket')(state);


state.songsManager.playNextSong();


// Only serve build in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, '..', 'web', 'build')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'web', 'build', 'index.html'));
    });
}

server.listen(process.env.PORT || 9000, () => {
    console.log('Hexo started');
});



