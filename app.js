const { Client } = require('whatsapp-web.js');
const fetch = require('node-fetch')
const fs = require('fs');
const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const qrcode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.get('/', (req, res) => {
    res.sendFile('index.html', {
        root: __dirname
    })
})

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

client.initialize();

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
    fs.unlinkSync(SESSION_FILE_PATH);
});

client.on('ready', () => {
    console.log('READY');
});

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
            }).catch(function (error) {
                client.sendMessage(msg.from, 'Server sedang tidak aktif');
                console.log(error);
            });
    }
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    fs.unlinkSync(SESSION_FILE_PATH);
});

server.listen(8000, function () {
    console.log('runing 8000')
})

io.on('connection', function (socket) {
    socket.emit('message', 'Connecting...');

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'QR Code received, scan please!');
        });
    });

    client.on('ready', () => {
        socket.emit('ready', 'Whatsapp is ready!');
        socket.emit('message', 'Whatsapp is ready!');
    });


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
                        socket.emit('pesan', [
                            msg.from,
                            'gagal'

                        ]);
                    } else {
                        client.sendMessage(msg.from, data.data);
                        socket.emit('pesan', [
                            msg.from,
                            'berhasil'
                        ]);
                    }
                }).catch(function (error) {
                    client.sendMessage(msg.from, 'Server sedang tidak aktif');
                    console.log(error);
                });
        }
    });



    client.on('authenticated', (session) => {
        socket.emit('authenticated', 'Whatsapp is authenticated!');
        socket.emit('message', 'Whatsapp is authenticated!');
        console.log('AUTHENTICATED', session);
        sessionCfg = session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
            if (err) {
                console.error(err);
            }
        });
    });

    client.on('auth_failure', function (session) {
        socket.emit('message', 'Auth failure, restarting...');
    });

    client.on('disconnected', (reason) => {
        socket.emit('message', 'Whatsapp is disconnected!');
        fs.unlinkSync(SESSION_FILE_PATH, function (err) {
            if (err) return console.log(err);
            console.log('Session file deleted!');
        });
        client.destroy();
        client.initialize();
    });
});