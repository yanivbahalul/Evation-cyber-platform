const { Server } = require('socket.io');

// === README FOR YANIV (Blue Team React Dashboard) ===========================
//
// This service is the WebSocket bridge between Max's telemetry pipeline and
// your React SPA. It uses socket.io with a token-gated handshake.
//
// 1. CONNECTING FROM REACT
//
//    import { io } from 'socket.io-client';
//
//    const socket = io(process.env.REACT_APP_BACKEND_URL, {
//        auth: { token: process.env.REACT_APP_ADMIN_SOCKET_TOKEN }
//    });
//
//    // Token must equal whatever ADMIN_SOCKET_TOKEN is set to in our .env.
//    // For local dev that's "admin-secret" (see project root .env).
//
// 2. LISTENING FOR TRAP EVENTS
//
//    useEffect(() => {
//        socket.on('liveAlert', (data) => {
//            // Push into your React state (useState / context / redux).
//            // Trigger re-render of REAL-TIME LOGS, STATS panel, Live Map.
//        });
//        return () => socket.off('liveAlert');
//    }, []);
//
// 3. THE `liveAlert` PAYLOAD SHAPE
//
//    {
//        attackerIp:     string,                    // raw IP, feed into your GeoIP lookup
//        trapType:       'SQLI' | 'XSS' | 'DATA_BOMB' | 'BRUTE_FORCE',
//        payload:        string,                    // raw malicious string
//        wasted_time_ms: number,                    // attacker time burned
//        bytes_sent:     number,                    // bandwidth burned
//        fingerprint: {
//            os:             string,           // e.g. "Linux", "Windows 10"
//            platform:       string,           // e.g. "Linux", "Win32", "Android"
//            browser:        string,
//            browserVersion: string,
//            deviceType:     'Mobile' | 'Desktop',
//            isBot:          boolean,          // true => show bot badge in UI
//            riskScore:      number            // per-event base; running total lives on AttackerProfile
//        }
//    }
//
// 4. UNAUTHORIZED CONNECTIONS
//    Anything without the right token is rejected by the io.use() middleware
//    below. This is the Phase 4 mitigation against "Zombie Connections".
// ============================================================================

let io;

const SocketService = {
    init: (httpServer) => {
        io = new Server(httpServer, {
            cors: {
                origin: '*', // Tighten to Yaniv's dashboard origin in production
                methods: ['GET', 'POST']
            }
        });

        const ADMIN_TOKEN = process.env.ADMIN_SOCKET_TOKEN || 'admin-secret';

        io.use((socket, next) => {
            const adminToken = socket.handshake.auth.token;

            if (adminToken === ADMIN_TOKEN) {
                next();
            } else {
                console.warn(`🛑 [SocketService] Blocked unauthorized Zombie Connection from ${socket.handshake.address}`);
                next(new Error('Unauthorized Access'));
            }
        });

        io.on('connection', (socket) => {
            console.log('🟢 [SocketService] Blue Team Admin Dashboard Connected securely.');

            socket.on('disconnect', () => {
                console.log('🔴 [SocketService] Dashboard Disconnected.');
            });
        });
    },

    // Called by the Decoy Controller (via telemetryTracker) whenever a trap fires.
    emitLiveAlert: (trapData) => {
        if (!io) {
            console.warn('⚠️ [SocketService] io is not initialized yet.');
            return;
        }

        io.emit('liveAlert', trapData);
        console.log(`📡 [SocketService] Broadcasted liveAlert: ${trapData.trapType} from ${trapData.attackerIp}`);
    }
};

module.exports = SocketService;
