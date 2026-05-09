const connectMaliciousDB = require('../db/maliciousDb');

// Initialize isolated telemetry connection once
let conn = null;
const getConnection = () => {
    if (!conn) conn = connectMaliciousDB();
    return conn;
};

/**
 * GET /api/admin/attackers
 * Returns all attacker profiles sorted by risk score (descending)
 */
const getAttackerProfiles = async (req, res) => {
    try {
        const connection = getConnection();
        const AttackerProfile = connection.model('AttackerProfile');
        const profiles = await AttackerProfile.find().sort({ riskScore: -1 });
        res.json({ success: true, data: profiles });
    } catch (err) {
        console.error('[AdminController] getAttackerProfiles error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch attacker profiles' });
    }
};

/**
 * GET /api/admin/events
 * Returns attack events with optional filtering
 * Query params: ?limit=50&trapType=SQL_INJECTION&ip=192.168.1.1
 */
const getAttackEvents = async (req, res) => {
    try {
        const connection = getConnection();
        const AttackEvent = connection.model('AttackEvent');
        
        const { limit = 100, trapType, ip } = req.query;
        const filter = {};
        if (trapType) filter.trapType = trapType;
        if (ip) filter.attackerIp = ip;

        const events = await AttackEvent.find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit, 10));
        
        res.json({ success: true, data: events });
    } catch (err) {
        console.error('[AdminController] getAttackEvents error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch attack events' });
    }
};

/**
 * GET /api/admin/honeytokens
 * Returns all HoneyToken bait credentials and their trigger status
 */
const getHoneyTokens = async (req, res) => {
    try {
        const connection = getConnection();
        const HoneyToken = connection.model('HoneyToken');
        const tokens = await HoneyToken.find();
        res.json({ success: true, data: tokens });
    } catch (err) {
        console.error('[AdminController] getHoneyTokens error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch honey tokens' });
    }
};

/**
 * POST /api/admin/ban
 * Bans an attacker IP (adds to firewall blacklist)
 * Body: { ip: "192.168.1.1", reason: "SQL Injection attempt" }
 */
const banAttacker = async (req, res) => {
    try {
        const connection = getConnection();
        const AttackerProfile = connection.model('AttackerProfile');
        const { ip, reason } = req.body;

        if (!ip) {
            return res.status(400).json({ success: false, error: 'IP address required' });
        }

        // Update profile with banned status
        await AttackerProfile.findOneAndUpdate(
            { ip },
            { 
                $set: { 
                    isBanned: true, 
                    banReason: reason,
                    bannedAt: new Date()
                }
            },
            { upsert: true }
        );

        // TODO: Integrate with actual firewall (iptables / fail2ban / cloud WAF)
        console.log(`[AdminController] Banned IP: ${ip} - Reason: ${reason}`);

        res.json({ success: true, message: `IP ${ip} has been banned` });
    } catch (err) {
        console.error('[AdminController] banAttacker error:', err);
        res.status(500).json({ success: false, error: 'Failed to ban attacker' });
    }
};

/**
 * GET /api/admin/stats
 * Returns aggregate statistics for dashboard widgets
 */
const getDashboardStats = async (req, res) => {
    try {
        const connection = getConnection();
        const AttackEvent = connection.model('AttackEvent');
        const AttackerProfile = connection.model('AttackerProfile');
        const HoneyToken = connection.model('HoneyToken');

        const [totalEvents, uniqueAttackers, triggeredTokens, topAttackers] = await Promise.all([
            AttackEvent.countDocuments(),
            AttackerProfile.countDocuments(),
            HoneyToken.countDocuments({ isTriggered: true }),
            AttackerProfile.find().sort({ riskScore: -1 }).limit(5)
        ]);

        // Aggregate wasted time
        const wastedTimeAgg = await AttackEvent.aggregate([
            { $group: { _id: null, totalWasted: { $sum: '$wasted_time_ms' } } }
        ]);
        const totalWastedMs = wastedTimeAgg[0]?.totalWasted || 0;

        res.json({
            success: true,
            data: {
                totalEvents,
                uniqueAttackers,
                triggeredTokens,
                totalWastedMs,
                topAttackers
            }
        });
    } catch (err) {
        console.error('[AdminController] getDashboardStats error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
};

module.exports = {
    getAttackerProfiles,
    getAttackEvents,
    getHoneyTokens,
    banAttacker,
    getDashboardStats
};
