const mongoose = require('mongoose');

// Phase 1: logical air-gapping
// This setup specifically isolates the Malicious DB from the standard connection.
let maliciousConn = null;
let maliciousConnDisabled = false;

const connectMaliciousDB = () => {
    if (maliciousConn) return maliciousConn;
    if (maliciousConnDisabled) return null;

    const URI = process.env.MALICIOUS_DB_URI;
    if (!URI) {
        maliciousConnDisabled = true;
        throw new Error('Missing MALICIOUS_DB_URI env var for malicious telemetry DB');
    }
    
    // We use createConnection to establish an isolated pipe.
    maliciousConn = mongoose.createConnection(URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        bufferCommands: false
    });

    maliciousConn.on('connected', () => {
        console.log('🔗 [Phase 1] Isolated Telemetry DB connected successfully.');
    });

    maliciousConn.on('error', (err) => {
        console.error('❌ [Phase 1] Telemetry DB connection error:', err);
    });

    // Bind Schemas strictly to this isolated connection
    maliciousConn.model('AttackerProfile', require('../models/AttackerProfile'));
    maliciousConn.model('AttackEvent', require('../models/AttackEvent'));
    maliciousConn.model('HoneyToken', require('../models/HoneyToken'));

    return maliciousConn;
};

module.exports = connectMaliciousDB;
