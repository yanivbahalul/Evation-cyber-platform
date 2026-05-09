const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const TRAP_TYPES = require('../constants/trapTypes');

const AttackEventSchema = new mongoose.Schema({
    // PDF spec PK. Auto-generated UUID so Yaniv's React rows have a stable
    // string key without dragging Mongo ObjectId types into the frontend.
    eventID: {
        type: String,
        default: () => randomUUID(),
        unique: true,
        index: true
    },
    attackerIp: {
        type: String,
        required: true,
        index: true
    },
    trapType: {
        type: String,
        enum: Object.values(TRAP_TYPES),
        required: true
    },
    payload: {
        type: String, // E.g., the SQL injection string or requested path
    },
    wasted_time_ms: {
        type: Number,
        default: 0
    },
    bytes_sent: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    // Pin the collection name so winston / mongoose can never disagree on where logs live.
    collection: 'attack_events'
});

module.exports = AttackEventSchema;
