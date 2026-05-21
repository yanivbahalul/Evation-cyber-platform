const mongoose = require('mongoose');
const attackLog = require('../utils/attackLog');

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

    maliciousConn = mongoose.createConnection(URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        bufferCommands: false
    });

    maliciousConn.on('connected', () => {
        attackLog.info('TELEMETRY', 'malicious_database_connected', {
            database: maliciousConn.name || 'telemetry',
        });
    });

    maliciousConn.on('error', (err) => {
        attackLog.error('TELEMETRY', 'malicious_database_error', { error: err.message });
    });

    maliciousConn.model('AttackerProfile', require('../models/AttackerProfile'));
    maliciousConn.model('AttackEvent', require('../models/AttackEvent'));
    maliciousConn.model('HoneyToken', require('../models/HoneyToken'));

    return maliciousConn;
};

module.exports = connectMaliciousDB;
