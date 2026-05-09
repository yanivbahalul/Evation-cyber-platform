const getAttackerIp = (req) => {
    // Priority 1: X-Forwarded-For (Used if there are multiple proxies)
    // Priority 2: X-Real-IP (The direct IP Sagiv injected)
    // Priority 3: req.socket.remoteAddress (The fallback connection IP)

    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];

    if (forwarded) {
        // forwarded can be a list: "client, proxy1, proxy2"
        // We take the first one in the list
        return forwarded.split(',')[0].trim();
    }

    return realIp || req.socket?.remoteAddress || req.ip;
};

module.exports = getAttackerIp;
