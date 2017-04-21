require('dotenv').config();

const nodeshout = require("nodeshout");
const express = require("express");
const path = require("path");
const EventEmitter = require('events');
const httpProxy = require('http-proxy');
const greenlock = require('greenlock-express');
const google = require('googleapis');


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

const state = {
    shout,
    app,
    events: new EventEmitter(),
};
state.youtube=google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API
});

let server;

// Only serve build in production
if (process.env.NODE_ENV === 'production') {
    const proxy = httpProxy.createProxyServer({});

    app.get('/music', function (req, res) {
        // You can define here your custom logic to handle the request
        // and then proxy the request.
        proxy.web(req, res, {
            target: 'http://127.0.0.1:8001/hexo',
            ignorePath: true,
        });
    });

    app.use(express.static(path.resolve(__dirname, '..', 'web', 'build')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'web', 'build', 'index.html'));
    });

    server = greenlock.create({
        server: process.env.SSL_SERVER,
        email: process.env.SSL_EMAIL,
        agreeTos: true,
        approvedDomains: process.env.SSL_DOMAINS.split(";"),
        app,
        debug: true
    }).listen(80, 443);

    // .then(() => {
    // console.log('Hexo started');
    // });
} else {

    server = require('http').createServer(app);

    server.listen(process.env.PORT || 9000, () => {
        console.log('Hexo started (dev)');
    });
}

state.io = require('socket.io')(server);
require('./songs')(state);
require('./socket')(state);
state.songsManager.playNextSong();
console.log('Starting audio...');
