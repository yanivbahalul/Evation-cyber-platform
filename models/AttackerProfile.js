const mongoose = require('mongoose');

const AttackerProfileSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        unique: true
    },
    // The "Dual-Storage" Strategy
    city: String,
    lat: Number,
    lng: Number,
    // Fingerprint Data
    os: String,
    platform: String,
    browser: String,
    deviceType: String,
    isBot: { type: Boolean, default: false },
    riskScore: {
        type: Number,
        default: 0
    },
    firstSeen: {
        type: Date,
        default: Date.now
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
});

module.exports = AttackerProfileSchema;
