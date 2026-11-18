const crypto = require('crypto');
const { verifyWithSupabase, syncUserToSupabaseAuth } = require('./supabaseClient');

// Server-only signing secret (never exposed to frontend)
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.ADMIN_KEY ||
  'coderscup-fast-nuces-karachi-jwt-secret-key-2026-v2';

/**
 * Hashes a plaintext password using PBKDF2/scrypt with a deterministic or random salt.
 */
function hashPassword(plainPassword, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plainPassword), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

/**
 * Timing-safe verification of a plaintext password against a stored "salt:hash" string.
 */
function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, keyHex] = storedHash.split(':');
  const derived = crypto.scryptSync(String(plainPassword), salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function base64UrlEncode(obj) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Buffer.from(json)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  const pad = 4 - (str.length % 4);
  const padded = str + (pad < 4 ? '='.repeat(pad) : '');
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Issues a cryptographically signed HS256 JWT token.
 */
function signJwt(payload, expiresInSeconds = 60 * 60 * 24) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(fullPayload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${signature}`;
}

/**
 * Verifies an HS256 JWT token and returns the decoded payload, or null if invalid/expired.
 */
function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, providedSig] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const bufA = Buffer.from(providedSig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null;
    }
    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * Authenticates user against Supabase Auth (and auto-provisions in Supabase Auth when verified).
 */
async function authenticateWithSupabase(emailOrUsername, password) {
  const res = await verifyWithSupabase(emailOrUsername, password);
  if (res.configured && res.authenticated) {
    return {
      enabled: true,
      success: true,
      supabaseUser: res.user,
      supabaseAccessToken: res.accessToken,
    };
  }
  return { enabled: res.configured, success: false };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  authenticateWithSupabase,
  syncUserToSupabaseAuth,
};
