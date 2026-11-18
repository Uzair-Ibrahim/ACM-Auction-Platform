require('./envLoader');

const DEFAULT_SUPABASE_URL = 'https://ahkomkxrpuhfqnezcuru.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_lBooEnBJVILL9ZUFcgbw_g_xxYCc0id';

function getSupabaseConfig() {
  const url = String(
    process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      DEFAULT_SUPABASE_URL
  )
    .trim()
    .replace(/\/$/, '');

  const publishableKey = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();

  const rawSecret = String(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  ).trim();
  // Ignore masked placeholder with bullet dots
  const secretKey = rawSecret && !rawSecret.includes('•') ? rawSecret : '';

  return {
    url,
    anonKey: publishableKey,
    publishableKey,
    serviceRoleKey: secretKey,
    secretKey,
    jwksUrl:
      process.env.SUPABASE_JWKS_URL ||
      `${url}/auth/v1/.well-known/jwks.json`,
    isConfigured: Boolean(url && (publishableKey || secretKey)),
  };
}

function toEmail(usernameOrEmail) {
  const clean = String(usernameOrEmail || '').trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean}@coderscup.fast.edu.pk`;
}

function buildSupabaseHeaders(apiKey, extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: apiKey,
    ...extra,
  };
  // Legacy JWT keys start with 'eyJ'; new sb_publishable_ / sb_secret_ keys work via apikey header (and Bearer if JWT)
  if (apiKey && apiKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * Verifies user credentials against Supabase Auth (/auth/v1/token?grant_type=password).
 */
async function verifyWithSupabase(username, password) {
  const { url, publishableKey, secretKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured || process.env.NODE_ENV === 'test') {
    return { configured: false };
  }

  const apiKey = publishableKey || secretKey;
  const email = toEmail(username);

  try {
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: buildSupabaseHeaders(apiKey),
      body: JSON.stringify({ email, password }),
    });

    if (authRes.ok) {
      const authData = await authRes.json();
      return {
        configured: true,
        authenticated: true,
        provider: 'supabase-auth',
        user: authData.user,
        accessToken: authData.access_token,
      };
    }
  } catch (_) {}

  return { configured: true, authenticated: false };
}

/**
 * Registers or syncs a user account into Supabase Auth.
 * Uses Admin API if SUPABASE_SECRET_KEY is set, or public /auth/v1/signup with SUPABASE_PUBLISHABLE_KEY.
 */
async function syncUserToSupabaseAuth(username, password, metadata = {}) {
  const { url, publishableKey, secretKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !password) return { synced: false };

  const email = toEmail(username);

  try {
    if (secretKey) {
      const headers = buildSupabaseHeaders(secretKey, {
        Authorization: `Bearer ${secretKey}`,
      });
      const listRes = await fetch(`${url}/auth/v1/admin/users`, { headers });
      if (listRes.ok) {
        const { users = [] } = await listRes.json();
        const existing = users.find((u) => String(u.email || '').toLowerCase() === email);
        if (existing) {
          const updRes = await fetch(`${url}/auth/v1/admin/users/${existing.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              password,
              email_confirm: true,
              user_metadata: { ...(existing.user_metadata || {}), ...metadata },
            }),
          });
          return { synced: updRes.ok, action: 'updated' };
        }
      }

      const createRes = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: metadata,
        }),
      });
      return { synced: createRes.ok, action: 'created' };
    }

    // Fallback using SUPABASE_PUBLISHABLE_KEY: ensure user is signed up in Supabase Auth
    if (publishableKey) {
      const signupRes = await fetch(`${url}/auth/v1/signup`, {
        method: 'POST',
        headers: buildSupabaseHeaders(publishableKey),
        body: JSON.stringify({
          email,
          password,
          data: metadata,
        }),
      });
      return { synced: signupRes.ok, action: 'signup' };
    }
  } catch (err) {
    return { synced: false, error: err.message };
  }
  return { synced: false };
}

/**
 * Saves the full auction state to Supabase `auction_state` table (for Vercel serverless persistence).
 */
async function saveAuctionStateToSupabase(stateObj) {
  const { url, publishableKey, secretKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return false;
  const key = secretKey || publishableKey;

  try {
    const res = await fetch(`${url}/rest/v1/auction_state`, {
      method: 'POST',
      headers: buildSupabaseHeaders(key, {
        Prefer: 'resolution=merge-duplicates',
      }),
      body: JSON.stringify({
        id: 'coderscup-2026',
        state_json: stateObj,
        updated_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Loads the full auction state from Supabase `auction_state` table.
 */
async function loadAuctionStateFromSupabase() {
  const { url, publishableKey, secretKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;
  const key = secretKey || publishableKey;

  try {
    const res = await fetch(
      `${url}/rest/v1/auction_state?id=eq.coderscup-2026&select=state_json`,
      {
        headers: buildSupabaseHeaders(key),
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows[0]?.state_json) {
      return rows[0].state_json;
    }
    return null;
  } catch (_) {
    return null;
  }
}

module.exports = {
  getSupabaseConfig,
  toEmail,
  verifyWithSupabase,
  syncUserToSupabaseAuth,
  saveAuctionStateToSupabase,
  loadAuctionStateFromSupabase,
};
