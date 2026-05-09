const mongoose = require('mongoose');

// Schema follows the PDF spec (fakeUsername / fakePassword / isTriggered) so
// Bar's serveHoneyToken trap can write directly into it. The triggeredLogs
// array is an additive forensics layer — every time the bait creds are used
// we append an entry (who, when, where) instead of just flipping a boolean.
const HoneyTokenSchema = new mongoose.Schema({
    fakeUsername: {
        type: String,
        required: true
    },
    fakePassword: {
        type: String,
        required: true
    },
    isTriggered: {
        type: Boolean,
        default: false
    },
    triggeredLogs: [{
        attackerIp: String,
        timestamp: { type: Date, default: Date.now },
        networkContext: String // e.g. SSH, HTTP, SMTP
    }]
});

module.exports = HoneyTokenSchema;
