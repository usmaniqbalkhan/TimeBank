const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SESSION_STORAGE_KEY = 'timebank.session';
const LEGACY_SESSION_STORAGE_KEY = 'raqam.session';

function hasNavigator() {
  return typeof navigator !== 'undefined';
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function ensureSupabaseConfig() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
}

function buildUrl(path, query) {
  const url = new URL(path, SUPABASE_URL);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
}

function makeNetworkError(requestName, error) {
  if (error?.name === 'AbortError') {
    if (requestName === 'transfer') {
      return new Error("We couldn't confirm the transfer because the network is unstable. Refresh your wallet before retrying.");
    }

    return new Error('The request timed out. Please try again on a stronger connection.');
  }

  if (hasNavigator() && navigator.onLine === false) {
    return new Error('No internet connection. Reconnect and try again.');
  }

  if (requestName === 'transfer') {
    return new Error("We couldn't reach the server to confirm the transfer. Refresh your wallet before retrying.");
  }

  return new Error('Unable to reach Supabase. Check your internet connection and try again.');
}

async function request(
  path,
  {
    method = 'GET',
    query,
    body,
    accessToken,
    headers = {},
    requestName = 'request',
    timeoutMs = 12000,
  } = {},
) {
  ensureSupabaseConfig();

  if (hasNavigator() && navigator.onLine === false) {
    throw new Error('No internet connection. Reconnect and try again.');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        payload?.msg ||
        payload?.message ||
        payload?.error_description ||
        payload?.error ||
        'Request failed.';

      throw new Error(message);
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.message !== 'Failed to fetch') {
      if (error.name === 'AbortError') {
        throw makeNetworkError(requestName, error);
      }

      throw error;
    }

    throw makeNetworkError(requestName, error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function unwrapSingle(payload) {
  return Array.isArray(payload) ? payload[0] || null : payload;
}

export function getStoredSession() {
  // Migrate any legacy raqam.session into timebank.session on first read.
  const legacy = localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
  if (legacy && !localStorage.getItem(SESSION_STORAGE_KEY)) {
    localStorage.setItem(SESSION_STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
  }

  const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function storeSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function signUpWithEmail({ name, email, password }) {
  const payload = await request('/auth/v1/signup', {
    method: 'POST',
    requestName: 'signup',
    body: {
      email: email.trim().toLowerCase(),
      password,
      data: {
        name: name.trim(),
      },
    },
  });

  if (payload.session?.access_token) {
    return payload.session;
  }

  return signInWithEmail({ email, password });
}

export async function signInWithEmail({ email, password }) {
  return request('/auth/v1/token', {
    method: 'POST',
    query: { grant_type: 'password' },
    requestName: 'login',
    body: {
      email: email.trim().toLowerCase(),
      password,
    },
  });
}

export async function signOut(accessToken) {
  try {
    await request('/auth/v1/logout', {
      method: 'POST',
      accessToken,
      requestName: 'logout',
    });
  } catch {
    // Local session cleanup still happens even if remote logout fails.
  }
}

export async function fetchAuthenticatedUser(accessToken) {
  return request('/auth/v1/user', { accessToken, requestName: 'user' });
}

export async function fetchCurrentUserProfile(accessToken, userId) {
  const [profile] = await request('/rest/v1/profiles', {
    accessToken,
    requestName: 'profile',
    query: {
      select: 'id,name,email,created_at,updated_at',
      id: `eq.${userId}`,
      limit: '1',
    },
  });

  return profile || null;
}

export async function fetchWalletDashboard(accessToken) {
  const payload = await request('/rest/v1/rpc/get_wallet_dashboard', {
    method: 'POST',
    accessToken,
    requestName: 'dashboard',
    body: {},
  });

  return unwrapSingle(payload) || payload;
}

export async function updateProfileName(accessToken, name) {
  const payload = await request('/rest/v1/rpc/update_profile_name', {
    method: 'POST',
    accessToken,
    requestName: 'profile',
    body: {
      p_name: name.trim(),
    },
  });

  return unwrapSingle(payload) || payload;
}

export async function lookupRecipientByCode(accessToken, walletCode) {
  const payload = await request('/rest/v1/rpc/lookup_recipient_by_code', {
    method: 'POST',
    accessToken,
    requestName: 'recipient',
    body: {
      p_wallet_code: walletCode.trim(),
    },
  });

  return unwrapSingle(payload) || payload;
}

export async function lookupRecipientByQr(accessToken, qrToken) {
  const payload = await request('/rest/v1/rpc/lookup_recipient_by_qr', {
    method: 'POST',
    accessToken,
    requestName: 'recipient',
    body: {
      p_qr_token: qrToken.trim(),
    },
  });

  return unwrapSingle(payload) || payload;
}

export async function transferMoneyByCode(accessToken, { receiverCode, amountPaisa, note = '', idempotencyKey }) {
  return request('/rest/v1/rpc/transfer_money_by_code', {
    method: 'POST',
    accessToken,
    requestName: 'transfer',
    timeoutMs: 15000,
    body: {
      p_receiver_code: receiverCode.trim(),
      p_amount_paisa: amountPaisa,
      p_note: note,
      p_idempotency_key: idempotencyKey,
    },
  });
}

export async function transferMoneyByQr(accessToken, { qrToken, amountPaisa, note = '', idempotencyKey }) {
  return request('/rest/v1/rpc/transfer_money_by_qr', {
    method: 'POST',
    accessToken,
    requestName: 'transfer',
    timeoutMs: 15000,
    body: {
      p_qr_token: qrToken.trim(),
      p_amount_paisa: amountPaisa,
      p_note: note,
      p_idempotency_key: idempotencyKey,
    },
  });
}
