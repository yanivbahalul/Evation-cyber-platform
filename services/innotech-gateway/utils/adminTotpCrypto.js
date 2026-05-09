const crypto = require('crypto');

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.ADMIN_TOTP_ENC_KEY_BASE64;
  if (!raw) {
    throw new Error('Missing ADMIN_TOTP_ENC_KEY_BASE64 for admin TOTP decryption');
  }
  // Accept both base64 and base64url (the admin panel stores local secrets as base64url).
  let buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    buf = Buffer.from(raw, 'base64url');
  }
  if (buf.length !== 32) throw new Error('ADMIN_TOTP_ENC_KEY_BASE64 must decode to 32 bytes');
  cachedKey = buf;
  return cachedKey;
}

function decryptTotpSecret({ ctB64, ivB64, tagB64 }) {
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = { decryptTotpSecret };

