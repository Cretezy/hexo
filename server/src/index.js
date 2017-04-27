require('dotenv').config({path: '../.env'});

const nodeshout = require("nodeshout");
const express = require("express");
const path = require("path");
const EventEmitter = require('events');
const httpProxy = require('http-proxy');
const greenlock = require('greenlock-express');

const app = express();

const state = {
    app,
    events: new EventEmitter(),
};


let server;

// Only serve build in production/staging
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    app.use(express.static(path.resolve(__dirname, '..', 'web', 'build')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'web', 'build', 'index.html'));
    });
}
if (process.env.USE_SSL === 'true') {
    server = greenlock.create({
        server: process.env.SSL_SERVER,
        email: process.env.SSL_EMAIL,
        agreeTos: true,
        approvedDomains: process.env.SSL_DOMAINS.split(","),
        app,
        debug: process.env.DEBUG
    }).listen(process.env.PORT || 80, process.env.PORT_SSL || 443);
} else {
    server = require('http').createServer(app);

    server.listen(process.env.PORT || 9000);
}

const proxy = httpProxy.createProxyServer({});

app.get('/music', (req, res) => {
    proxy.web(req, res, {
        target: `http://${process.env.ICECAST_HOST}:${process.env.ICECAST_PORT}/${process.env.ICECAST_MOUNT}`,
        ignorePath: true,
    });
});

state.io = require('socket.io')(server);
require('./songs')(state);
require('./socket')(state);
console.log('Starting audio...');
