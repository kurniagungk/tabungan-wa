const { Client, Buttons } = require('whatsapp-web.js');
const fetch = require('node-fetch')
const db = require('./db.js');
const express = require('express');
const qrcode = require('qrcode');
const { body, validationResult } = require('express-validator');
const bodyParser = require('body-parser')
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const https = require("https");
const agent = new https.Agent({
    rejectUnauthorized: false
})
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';
const TABUNGAN = process.env.URL || 'https://tabungan.test';

let ready = false;
let start = false;
let emit = null;
let code = 0;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


(async () => {

    app.get('/', (req, res) => {
        res.sendFile(INDEX, { root: __dirname })
    });

    const dbSesion = await db.readsession()

    const client = new Client({
        restartOnAuthFail: true,
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
        session: dbSesion
    });
    // You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.
    // This object must include WABrowserId, WASecretBundle, WAToken1 and WAToken2.

    if (dbSesion) {
        console.log('start whatapps sesion');
        client.initialize().catch(_ => _);
        start = true;
    }

    const checkRegisteredNumber = async function (number) {
        const isRegistered = await client.isRegisteredUser(number);
        return isRegistered;
    }

    app.post('/send', [
        body('token').notEmpty(),
        body('no').notEmpty(),
        body('pesan').notEmpty(),
    ], async (req, res) => {
        let token = req.body.token
        let no = req.body.no
        let pesan = req.body.pesan

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        if (token != "VGFidW5nYW4gQWxrYWhmaSBTb21hbGFuZ3U=") {
            return res.sendStatus(403);
        }

        if (!ready)
            return res.status(422).json({
                status: false,
                message: 'Whatapps Not Login'
            });


        const isRegisteredNumber = await checkRegisteredNumber(no + '@c.us');

        if (!isRegisteredNumber) {
            return res.status(422).json({
                status: false,
                message: 'The number is not registered'
            });
        }

        client.sendMessage(no + '@c.us', pesan);

        res.status(200).json({
            status: true,
            message: 'Berhasil'
        });
    });

    io.on('connection', function (socket) {
        emit = socket;
        socket.emit("status", ready);
        console.log('connection')
        socket.on("start", (arg) => {
            console.log('start');
            if (!start)
                client.initialize().catch(_ => _);
            start = true;
        });

        socket.on("stop", (arg) => {
            console.log('stop');
            if (start) {
                client.destroy();
            }
            start = false
        });
        socket.on("disconnect", (reason) => {
            if (!ready && start) {
                console.log('asd')
                qr = 0;
                client.destroy();
                start = null;
            }
            console.log('disconnect');
        });


    });





    client.on('message', async msg => {


        if (msg.isStatus)
            return 0;

        let chat = await msg.getChat();

        if (chat.isGroup)
            return 0;

        console.log('message');

        let no = msg.from;

        let url = TABUNGAN + '/ceksaldo?no=' + no + '&pesan=' + msg.body + '&token=' + 'VGFidW5nYW4gQWxrYWhmaSBTb21hbGFuZ3U=';

        fetch(url, { agent })
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

        console.log('qr');
        qrcode.toDataURL(qr, (err, url) => {
            if (emit)
                emit.emit('qr', url);
        });
        code++;
        if (code == 3) {
            ready = false;
            console.log(code)
            code = 0;
            if (emit)
                emit.emit('status', ready);
            client.destroy();
            start = false
        }
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
        db.updateSesion(session)
    });

    client.on('auth_failure', function (session) {
        console.log('auth_failure')
        ready = false;
        if (emit)
            emit.emit('status', ready);
        db.updateSesion(null)
        start = true;
    });

    client.on('disconnected', (reason) => {
        console.log('wa disconnected');
        ready = false;
        if (emit)
            emit.emit('status', ready);
        db.updateSesion(null)
        code = 0;
        client.destroy();
        start = false;
    });


})();

server.listen(PORT, () => {
    console.log('listening on *:' + PORT);
});