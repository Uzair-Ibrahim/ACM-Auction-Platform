require('./envLoader');

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = String(
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  ).trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  return {
    url,
    anonKey,
    serviceRoleKey,
    isConfigured: Boolean(url && (anonKey || serviceRoleKey)),
  };
}

function toEmail(usernameOrEmail) {
  const clean = String(usernameOrEmail || '').trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean}@coderscup.fast.edu.pk`;
}

/**
 * Verifies user credentials against Supabase Auth (/auth/v1/token?grant_type=password)
 * or against the Supabase `auction_accounts` table if present.
 */
async function verifyWithSupabase(username, password) {
  const { url, anonKey, serviceRoleKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return { configured: false };
  }

  const apiKey = serviceRoleKey || anonKey;
  const email = toEmail(username);

  try {
    // 1. Try Supabase GoTrue Auth sign-in
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey || apiKey,
      },
      body: JSON.stringify({ email, password }),
    });

    if (authRes.ok) {
      const authData = await authRes.json();
      return {
        configured: true,
        authenticated: true,
        provider: 'supabase-auth',
        user: authData.user,
      };
    }
  } catch (_) {}

  return { configured: true, authenticated: false };
}

/**
 * If SUPABASE_SERVICE_ROLE_KEY is provided, creates or updates the user's password in Supabase Auth
 * whenever Admin updates a House password or Admin password!
 */
async function syncUserToSupabaseAuth(username, password, metadata = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!url || !serviceRoleKey || !password) return { synced: false };

  const email = toEmail(username);
  const headers = {
    'Content-Type': 'application/json',
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  try {
    // List users to check if user already exists
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

    // Create user in Supabase Auth
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
  } catch (err) {
    return { synced: false, error: err.message };
  }
}

/**
 * Saves the full auction state to Supabase `auction_state` table (for Vercel serverless persistence).
 */
async function saveAuctionStateToSupabase(stateObj) {
  const { url, anonKey, serviceRoleKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return false;
  const key = serviceRoleKey || anonKey;

  try {
    const res = await fetch(`${url}/rest/v1/auction_state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'resolution=merge-duplicates',
      },
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
  const { url, anonKey, serviceRoleKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;
  const key = serviceRoleKey || anonKey;

  try {
    const res = await fetch(
      `${url}/rest/v1/auction_state?id=eq.coderscup-2026&select=state_json`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
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
