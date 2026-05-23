const getAttackerIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return realIp || req.socket?.remoteAddress || req.ip;
};

module.exports = getAttackerIp;
