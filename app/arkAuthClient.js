'use client';

export const SUPABASE_URL = 'https://svdigxqdivcmljirjwhk.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InN2ZGlneHFkaXZjbWxqaXJqd2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTg3NDYsImV4cCI6MjEwMjg3NDc0Nn0.otGWq3hDPDKNAVHNvPkWHZhK7ezlSFZffEAcQlc0RzY';
export const SESSION_KEY = 'ark-auth-session';
export const STATE_KEY = 'ark-tracker-v1';
export const STATE_VERSION_KEY = '__arkUpdatedAt';

export function readSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

export function writeSession(session) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('ark-session-refreshed', { detail: { expires_at: session?.expires_at || 0 } }));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

function baseHeaders(token, json = true) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.msg || data?.error_description || data?.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: baseHeaders(null),
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = await parseResponse(response);
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
    user: data.user,
  };
  writeSession(session);
  return session;
}

export async function signUp(fullName, email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: baseHeaders(null),
    body: JSON.stringify({ email: email.trim(), password, data: { full_name: fullName.trim() } }),
  });
  const data = await parseResponse(response);
  if (data?.access_token) {
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
      user: data.user,
    };
    writeSession(session);
    return { session, needsConfirmation: false };
  }
  return { session: null, needsConfirmation: true, user: data?.user || null };
}

export async function refreshSession(session = readSession()) {
  if (!session?.refresh_token) throw new Error('Session expired. Please sign in again.');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: baseHeaders(null),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const data = await parseResponse(response);
  const next = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
    user: data.user || session.user,
  };
  writeSession(next);
  return next;
}

export async function ensureFreshSession(session = readSession()) {
  if (!session?.access_token) return null;
  if (Number(session.expires_at || 0) < Math.floor(Date.now() / 1000) + 120) return refreshSession(session);
  return session;
}

async function authenticatedFetch(url, init = {}, session = readSession(), retry = true) {
  let fresh = await ensureFreshSession(session);
  if (!fresh?.access_token) throw new Error('Session expired. Please sign in again.');
  const json = init.json !== false;
  const headers = { ...baseHeaders(fresh.access_token, json), ...(init.headers || {}) };
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401 && retry) {
    fresh = await refreshSession(fresh);
    return authenticatedFetch(url, init, fresh, false);
  }
  return response;
}

export async function fetchMyProfile(session) {
  const fresh = await ensureFreshSession(session);
  const uid = fresh?.user?.id;
  if (!uid) throw new Error('Invalid session.');
  const response = await authenticatedFetch(`${SUPABASE_URL}/rest/v1/ark_tracker_profiles?user_id=eq.${encodeURIComponent(uid)}&select=*`, {
    method: 'GET', json: false, cache: 'no-store',
  }, fresh);
  const rows = await parseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function listProfiles(session) {
  const response = await authenticatedFetch(`${SUPABASE_URL}/rest/v1/ark_tracker_profiles?select=*&order=created_at.desc`, {
    method: 'GET', json: false, cache: 'no-store',
  }, session);
  return parseResponse(response);
}

export async function updateProfile(session, userId, patch) {
  const response = await authenticatedFetch(`${SUPABASE_URL}/rest/v1/ark_tracker_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  }, session);
  return parseResponse(response);
}

export async function rpc(session, name, args = {}) {
  const response = await authenticatedFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(args),
    cache: 'no-store',
  }, session);
  return parseResponse(response);
}

export async function loadTrackerStateWithMeta(session) {
  return rpc(session, 'ark_tracker_get_state');
}

export async function loadTrackerState(session) {
  const result = await loadTrackerStateWithMeta(session);
  return { ...(result?.data || {}), [STATE_VERSION_KEY]: result?.updated_at || null };
}

export async function saveTrackerState(session, data, baseUpdatedAt = null) {
  const effectiveBase = baseUpdatedAt || data?.[STATE_VERSION_KEY] || null;
  const clean = { ...(data || {}) };
  delete clean[STATE_VERSION_KEY];
  return rpc(session, 'ark_tracker_save_state_v2', { p_data: clean, p_base_updated_at: effectiveBase });
}

export async function buyShopItem(session, itemId) {
  return rpc(session, 'ark_tracker_buy_shop_item', { p_item_id: itemId });
}

export async function setShopOrderStatus(session, orderId, status) {
  return rpc(session, 'ark_tracker_set_order_status', { p_order_id: orderId, p_status: status });
}

export async function createTrackerBackup(session, label = 'manual') {
  return rpc(session, 'ark_tracker_create_backup', { p_label: label });
}

export async function uploadShopImage(session, file) {
  if (!file) return '';
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Only JPG, PNG or WEBP images are allowed.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be smaller than 2 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const response = await authenticatedFetch(`${SUPABASE_URL}/storage/v1/object/ark-shop-images/${path}`, {
    method: 'POST',
    json: false,
    headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  }, session);
  await parseResponse(response);
  return `${SUPABASE_URL}/storage/v1/object/public/ark-shop-images/${path}`;
}

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('en-US')} UZS`;
}

export function levelFor(xp) {
  const n = Number(xp || 0);
  if (n >= 5000) return 'Diamond';
  if (n >= 3000) return 'Gold';
  if (n >= 1500) return 'Silver';
  if (n >= 500) return 'Bronze';
  return 'Starter';
}
