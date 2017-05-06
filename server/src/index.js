require('dotenv').config({path: '../.env'});

const express = require("express");
const path = require("path");
const EventEmitter = require('events');
const httpProxy = require('http-proxy');

const app = express();

const state = {
    app,
    events: new EventEmitter(),
};


const proxy = httpProxy.createProxyServer({});

app.get('/music', (req, res) => {
    proxy.web(req, res, {
        target: `http://${process.env.ICECAST_HOST}:${process.env.ICECAST_PORT}/${process.env.ICECAST_MOUNT}`,
        ignorePath: true,
    });
});

let server;


// Only serve build in production/staging
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    app.use(express.static(path.resolve(__dirname, '..', '..', 'web', 'build-prod')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', '..', 'web', 'build', 'index.html'));
    });
}

server = require('http').createServer(app);

server.listen(process.env.PORT || 9000);


state.io = require('socket.io')(server);
require('./songs')(state);
require('./socket')(state);
console.log('Starting audio...');
