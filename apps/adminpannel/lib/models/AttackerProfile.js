// Keep in sync with services/logging-data-extraction/models/AttackerProfile.js
const mongoose = require('mongoose');

const AttackerProfileSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        unique: true
    },
    city: String,
    lat: Number,
    lng: Number,
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
    },
    traceIds: {
        type: [String],
        default: [],
    },
});

module.exports = AttackerProfileSchema;
