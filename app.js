const { Client } = require('whatsapp-web.js');
const fetch = require('node-fetch')
const fs = require('fs');

const express = require('express');

const qrcode = require('qrcode');
const { url } = require('inspector');

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

let ready = false;
let start = false;
let emit = null;

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
            '--disable-extensions'
        ],
    },
    session: sessionCfg
});
// You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.
// This object must include WABrowserId, WASecretBundle, WAToken1 and WAToken2.

if (fs.existsSync(SESSION_FILE_PATH)) {
    console.log('start whatapps');
    client.initialize();
    start == true;
}




io.on('connection', function (socket) {
    emit = socket;
    socket.emit("status", ready);
    console.log('connection')
    socket.on("start", (arg) => {
        if (!start)
            client.initialize();
        start == true
    });

    socket.on("stop", (arg) => {
        if (start)
            client.destroy();
        if (fs.existsSync(SESSION_FILE_PATH)) {
            fs.unlinkSync(SESSION_FILE_PATH);
        }
        start == false
    });
    socket.on("disconnect", (reason) => {
        if (!ready && start)
            client.destroy();
        console.log('disconnect');
    });


});





client.on('message', msg => {



    let no = msg.from;

    let url = 'http://tabungan.test/ceksaldo?no=' + no + '&pesan=' + msg.body + '&token=' + 'VGFidW5nYW4gQWxrYWhmaSBTb21hbGFuZ3U=';

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw Error(response.statusText);
            }
            return response.json();
        })
        .then(data => {

            if (data.status == 401)
                client.sendMessage(msg.from, 'Gagal Memuat Data');

            if (data.status == 404)
                client.sendMessage(msg.from, 'Pesan Tidak Benar');
            if (data.status == 403)
                client.sendMessage(msg.from, 'Nomer Tidak Terdaftar');
            if (data.status == 200)
                client.sendMessage(msg.from, data.data);
            if (emit)
                emit.emit('pesan', true);
        }).catch(function (error) {
            client.sendMessage(msg.from, 'Server sedang tidak aktif');
            console.log(error);
        });

});


client.on('qr', (qr) => {
    ready = false;
    qrcode.toDataURL(qr, (err, url) => {
        if (emit)
            emit.emit('qr', url);
    });
});

client.on('ready', () => {
    console.log('ready');
    ready = true;
    if (emit)
        emit.emit('ready', ready);
});


client.on('authenticated', (session) => {
    console.log('authenticated');
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
    if (fs.existsSync(SESSION_FILE_PATH)) {
        fs.unlinkSync(SESSION_FILE_PATH);
    }
    client.destroy();
    start == false;
    console.log('auth_failure')

});

client.on('disconnected', (reason) => {
    ready = false;
    if (emit)
        emit.emit('status', ready);
    if (fs.existsSync(SESSION_FILE_PATH)) {
        fs.unlinkSync(SESSION_FILE_PATH);
    }
    client.destroy();
    start == false;
});


