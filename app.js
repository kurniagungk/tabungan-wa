const { Client } = require('whatsapp-web.js');
const fetch = require('node-fetch')
const fs = require('fs');

const express = require('express');

const qrcode = require('qrcode');

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

let ready = false;

const server = express()
    .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


const SESSION_FILE_PATH = './session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}


const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
    },
    session: sessionCfg
});
// You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.
// This object must include WABrowserId, WASecretBundle, WAToken1 and WAToken2.
let emit = null;

io.on('connection', function (socket) {
    emit = socket;
    console.log('connection')
    socket.emit('status', ready);

});





client.initialize();




client.on('message', msg => {

    if (msg.body === "saldo") {

        let no = msg.from;

        fetch('http://tabungan.test/ceksaldo?no=' + no)
            .then(response => {
                if (!response.ok) {
                    throw Error(response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (data.status == 404) {
                    client.sendMessage(msg.from, 'No Hp tidak terdaftar');
                } else {
                    client.sendMessage(msg.from, data.data);
                }
                if (emit)
                    emit.emit('pesan', true);
            }).catch(function (error) {
                client.sendMessage(msg.from, 'Server sedang tidak aktif');
                console.log(error);
            });
    }
});


client.on('qr', (qr) => {
    ready = false;
    if (emit)
        emit.emit('status', ready);
    qrcode.toDataURL(qr, (err, url) => {
        if (emit)
            emit.emit('qr', url);
    });
});

client.on('ready', () => {
    ready = true;
    if (emit)
        emit.emit('ready', ready);
});


client.on('authenticated', (session) => {
    ready = true;
    if (emit)
        emit.emit('status', ready);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

client.on('auth_failure', function (session) {
    ready = false;
    if (emit)
        emit.emit('status', ready);
    socket.emit('message', 'Auth failure, restarting...');
    client.destroy();
    client.initialize();
});

client.on('disconnected', (reason) => {
    ready = false;
    if (emit)
        emit.emit('status', ready);
    fs.unlinkSync(SESSION_FILE_PATH);
    client.destroy();
    client.initialize();
});


