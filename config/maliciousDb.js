const mongoose = require('mongoose');

// Phase 1: logical air-gapping
// This setup specifically isolates the Malicious DB from the standard connection.
let maliciousConn = null;

const connectMaliciousDB = () => {
    if (maliciousConn) return maliciousConn;

    // Retrieve connection string from env later
    const URI = process.env.MALICIOUS_DB_URI || 'mongodb://localhost:27017/telemetry_blackbox';
    
    // We use createConnection to establish an isolated pipe.
    maliciousConn = mongoose.createConnection(URI);

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
