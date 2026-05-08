// tests/mockAttack.js
//
// End-to-end smoke test for Max's telemetry pipeline.
//
// What it proves:
//   1. The Socket.io handshake accepts a valid ADMIN_SOCKET_TOKEN.
//   2. Hitting a trap route (/test-trap) flows through telemetryTracker.
//   3. SocketService.emitLiveAlert reaches the dashboard channel.
//   4. The payload shape matches what Yaniv's React SPA expects.
//
// Run order:
//   Terminal 1: npm start              (spins up testServer.js)
//   Terminal 2: npm run mock-attack    (runs this file)
//
// Exits 0 on success, 1 on failure.

require('dotenv').config();
const { io } = require('socket.io-client');
const http = require('http');

const SERVER = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const TOKEN = process.env.ADMIN_SOCKET_TOKEN || 'admin-secret';
const TIMEOUT_MS = 10_000;

const REQUIRED_PAYLOAD_KEYS = [
    'attackerIp', 'trapType', 'payload', 'wasted_time_ms', 'bytes_sent', 'fingerprint'
];

let alertReceived = false;

const fail = (msg) => {
    console.error(`❌ ${msg}`);
    process.exit(1);
};

const pass = (msg) => {
    console.log(`✅ ${msg}`);
};

const hardTimeout = setTimeout(
    () => fail(`Test timed out after ${TIMEOUT_MS}ms (server up? token correct?)`),
    TIMEOUT_MS
);

console.log(`→ Connecting to ${SERVER} as Blue Team dashboard...`);

const socket = io(SERVER, {
    auth: { token: TOKEN },
    reconnection: false
});

socket.on('connect_error', (err) => {
    fail(`Socket auth rejected: ${err.message}`);
});

socket.on('connect', () => {
    pass(`WebSocket handshake accepted (token=${TOKEN})`);

    socket.on('liveAlert', (data) => {
        alertReceived = true;
        pass(`Received liveAlert from server`);

        const missing = REQUIRED_PAYLOAD_KEYS.filter((k) => !(k in data));
        if (missing.length) {
            fail(`liveAlert payload missing keys: ${missing.join(', ')}`);
        }
        pass(`Payload shape OK: ${REQUIRED_PAYLOAD_KEYS.join(', ')}`);
        console.log('   →', JSON.stringify(data, null, 2).split('\n').join('\n   '));

        clearTimeout(hardTimeout);
        socket.close();
        process.exit(0);
    });

    // Trigger a trap by calling the test endpoint over plain HTTP.
    setTimeout(() => {
        console.log(`→ Firing fake attack: GET ${SERVER}/test-trap`);
        http.get(`${SERVER}/test-trap`, (res) => {
            res.resume();
            res.on('end', () => {
                pass(`/test-trap completed (status=${res.statusCode})`);
                // The liveAlert is emitted from res.on('finish') on the server side,
                // which fires after this response is closed. Give it a moment.
                setTimeout(() => {
                    if (!alertReceived) {
                        fail('Server completed the trap but no liveAlert arrived (broadcast pipeline broken)');
                    }
                }, 2_000);
            });
        }).on('error', (err) => {
            fail(`HTTP request to /test-trap failed: ${err.message}`);
        });
    }, 500);
});
