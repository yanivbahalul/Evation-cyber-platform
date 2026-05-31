const { Server } = require('socket.io');
const { attackLog } = require('@evation/shared-utils');

let io;

const SocketService = {
    init: (httpServer) => {
        const allowedOrigins = (process.env.ADMIN_DASHBOARD_ORIGINS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        const isProd = process.env.NODE_ENV === 'production';
        // Dev: always allow the browser origin (localhost, LAN IP, ngrok HTTPS).
        // Prod: restrict to ADMIN_DASHBOARD_ORIGINS when set.
        const corsOrigin = !isProd ? true : allowedOrigins.length > 0 ? allowedOrigins : false;

        io = new Server(httpServer, {
            cors: {
                origin: corsOrigin,
                methods: ['GET', 'POST']
            }
        });

        const ADMIN_TOKEN = process.env.ADMIN_SOCKET_TOKEN;
        if (!ADMIN_TOKEN) {
            throw new Error('Missing ADMIN_SOCKET_TOKEN env var for SocketService');
        }

        io.use((socket, next) => {
            const adminToken = socket.handshake.auth.token;

            if (adminToken === ADMIN_TOKEN) {
                next();
            } else {
                attackLog.warn('TELEMETRY', 'socket_connection_rejected_bad_token', {
                    address: socket.handshake.address,
                });
                next(new Error('Unauthorized Access'));
            }
        });

        io.on('connection', (socket) => {
            attackLog.info('TELEMETRY', 'admin_dashboard_connected', { socket_id: socket.id });

            socket.on('disconnect', () => {
                attackLog.info('TELEMETRY', 'admin_dashboard_disconnected', { socket_id: socket.id });
            });
        });

        attackLog.info('TELEMETRY', 'socket_server_ready', { port: process.env.PORT || 3002 });
    },

    emitLiveAlert: (trapData) => {
        if (!io) {
            attackLog.warn('ATTACK', 'live_alert_skipped_socket_not_ready', { trap: trapData?.trapType });
            return;
        }

        try {
            io.emit('liveAlert', trapData);
            attackLog.info('ATTACK', 'live_alert_broadcast_to_admin_ui', {
                trap: trapData?.trapType,
                trap_label: attackLog.trapLabel(trapData?.trapType),
                ip: trapData?.attackerIp,
                wasted_ms: trapData?.wasted_time_ms,
                bytes: trapData?.bytes_sent,
            });
        } catch (err) {
            attackLog.error('ATTACK', 'live_alert_broadcast_failed', {
                trap: trapData?.trapType,
                error: err?.message || err,
            });
        }
    }
};

module.exports = SocketService;
