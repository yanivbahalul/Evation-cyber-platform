# Telemetry & Intelligence - Setup & Execution Guide

This guide explains exactly how to bring your "Black Box" code to life, where to place the missing pieces, and how to test everything.

---

## 2. Connect to a Real Database

**The Goal:** Connect your logically isolated `maliciousDb.js` to a real MongoDB Atlas cluster.

**How it works:** Your code currently looks for an environment variable called `process.env.MALICIOUS_DB_URI`. If it doesn't find it, it falls back to a local database (`mongodb://localhost:27017/telemetry_blackbox`).

**Where to write exactly:**
1.  **Create a `.env` file:** In the root folder of the project (next to `package.json` and `README.md`), create a file named exactly `.env`.
2.  **Add your connection string:** Inside that `.env` file, paste your MongoDB connection string:
    ```env
    MALICIOUS_DB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/telemetry_blackbox?retryWrites=true&w=majority
    ```
    *(Replace `<username>` and `<password>` with your actual MongoDB Atlas credentials.)*
3.  **Load the `.env` file:** For the server to read this file, you must install the `dotenv` package (`npm install dotenv`) and add this line to the **very top** of your main server file (e.g., `app.js`):
    ```javascript
    require('dotenv').config();
    ```

---

## 3. Wire It Into the Main Server (app.js / server.js)

**The Goal:** Your code is currently modular (separated into clean folders). It needs to be imported into the main Express application to actually run when the server starts.

**Where to write exactly:**
When your team creates the main server file (usually named `app.js`, `server.js`, or `index.js` in the root folder), you need to inject your components into it.

Here is what the final `app.js` should look like with your code injected:

```javascript
// --- 1. Load Environment Variables ---
require('dotenv').config(); 

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);
const useragent = require('express-useragent');

// --- 2. Initialize Max's Telemetry Components ---

// A. Connect the Isolated Database
const connectMaliciousDB = require('./config/maliciousDb');
const maliciousConn = connectMaliciousDB(); // Triggers the connection!

// B. Load Express-Useragent (Required for your Phase 3)
app.use(useragent.express()); 

// C. Attach Your Fingerprint Middleware (Runs on every request)
const fingerprintMiddleware = require('./middlewares/fingerprint');
app.use(fingerprintMiddleware);

// --- 3. Rest of the Team's Routes (Sagiv, Bar, Yaniv) ---
app.get('/', (req, res) => {
    res.send('Safe Zone');
});

// --- 4. Max's Real-Time Socket Setup ---
io.on('connection', (socket) => {
    console.log('Admin Dashboard Connected via Socket');

    // Here, you listen for the mock attack test!
    socket.on('testLiveAlert', (data) => {
        console.log("⚠️ TEST ALERT RECEIVED FROM MOCK:", data);
        
        // This is where you would normally save to the DB via LoggerService
        // And then broadcast to Yaniv's React Dashboard:
        // io.emit('frontendAdminAlert', data);
    });
});

// --- 5. Start Server ---
http.listen(3000, () => {
    console.log('Server is running on port 3000');
});
```

---

## 4. Run the Socket Test

**The Goal:** You don't need to wait for attackers or your teammates' traps to see if your Telemetry pipeline works. You built a "Heartbeat" simulator in `tests/mockAttack.js`.

**Where is it?**
It is located at `tests/mockAttack.js`.

**How it works:**
The `mockAttack.js` script acts like a fake attacker. It uses the `socket.io-client` library to connect to your local server (just like a browser would) and emits a fake JSON payload (`testLiveAlert`) every 30 seconds. 

**How to run it:**
You will need **TWO** terminal windows open to test this properly.

1.  **Terminal Window 1 (The Server):**
    Start your main application (once `app.js` is created).
    ```bash
    node app.js
    ```
    *You should see "Isolated Telemetry DB connected successfully" and "Server is running on port 3000".*

2.  **Terminal Window 2 (The Mock Attacker):**
    While the server is running, open a new terminal tab and run your test script:
    ```bash
    node tests/mockAttack.js
    ```
    *You will see the script say "Sent mock alert...".*
    *If you look back at **Terminal Window 1**, the server will log "⚠️ TEST ALERT RECEIVED FROM MOCK: { ... }" showing that your real-time pipe is fully functional!*
