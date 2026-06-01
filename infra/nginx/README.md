## NGINX

Owner: Sagiv Levy

  nginx.conf — Reverse proxy rules:
    /gateway/*     → innotech-gateway :4001
    /socket.io/*   → logging-data-extraction :3002
    /              → admin-panel :3000

Mission 1.1: SSL/TLS termination, header injection for true client IP.
