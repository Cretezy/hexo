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

// Only serve build in production
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    app.get('/music', (req, res) => {
        proxy.web(req, res, {
            target: 'http://127.0.0.1:8001/hexo',
            ignorePath: true,
        });
    });

    app.use(express.static(path.resolve(__dirname, '..', 'web', 'build')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'web', 'build', 'index.html'));
    });
}
if (process.env.NODE_ENV === 'production') {
    const proxy = httpProxy.createProxyServer({});

    server = greenlock.create({
        server: process.env.SSL_SERVER,
        email: process.env.SSL_EMAIL,
        agreeTos: true,
        approvedDomains: process.env.SSL_DOMAINS.split(","),
        app,
        // debug: true
    }).listen(80, 443);

} else {
    server = require('http').createServer(app);

    server.listen(process.env.PORT || 9000);
}

state.io = require('socket.io')(server);
require('./songs')(state);
require('./socket')(state);
console.log('Starting audio...');
