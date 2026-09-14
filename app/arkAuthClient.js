'use client';

export const SUPABASE_URL = 'https://svdigxqdivcmljirjwhk.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBiYXNlIiwicmVmIjoic3ZkaWd4cWRpdmNtbGppcmp3aGsiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NzI5ODc0NiwiZXhwIjoyMTAyODc0NzQ2fQ.otGWq3hDPDKNAVHNvPkWHZhK7ezlSFZffEAcQlc0RzY';
export const SESSION_KEY = 'ark-auth-session';
export const STATE_KEY = 'ark-tracker-v1';
export const WEEKLY_POINTS_TIME_ZONE = 'Asia/Tashkent';

export function weeklyPointsCycleKey(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WEEKLY_POINTS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const y = Number(values.year);
  const m = Number(values.month);
  const d = Number(values.day);
  const isoDow = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 })[values.weekday] || 1;
  const cycle = new Date(Date.UTC(y, m - 1, d));
  cycle.setUTCDate(cycle.getUTCDate() + (isoDow === 7 ? 1 : -(isoDow - 1)));
  return `${cycle.getUTCFullYear()}-${String(cycle.getUTCMonth() + 1).padStart(2, '0')}-${String(cycle.getUTCDate()).padStart(2, '0')}`;
}

export function normalizeWeeklyPointsState(data, at = new Date()) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data || {};
  const cycle = weeklyPointsCycleKey(at);
  if (data.weeklyPointsCycle === cycle) return data;
  return {
    ...data,
    students: (Array.isArray(data.students) ? data.students : []).map(student => ({ ...student, pts: 0 })),
    weeklyPointsCycle: cycle,
    weeklyPointsResetAt: at.toISOString(),
  };
}

export function readSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

export function writeSession(session) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
  if (Number(session.expires_at || 0) < Math.floor(Date.now() / 1000) + 90) {
    return refreshSession(session);
  }
  return session;
}

export async function fetchMyProfile(session) {
  const uid = session?.user?.id;
  if (!uid) throw new Error('Invalid session.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/ark_tracker_profiles?user_id=eq.${encodeURIComponent(uid)}&select=*`, {
    headers: baseHeaders(session.access_token, false),
    cache: 'no-store',
  });
  const rows = await parseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function listProfiles(session) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/ark_tracker_profiles?select=*&order=created_at.desc`, {
    headers: baseHeaders(session.access_token, false),
    cache: 'no-store',
  });
  return parseResponse(response);
}

export async function updateProfile(session, userId, patch) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/ark_tracker_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { ...baseHeaders(session.access_token), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  return parseResponse(response);
}

export async function rpc(session, name, args = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: baseHeaders(session.access_token),
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  return parseResponse(response);
}

export async function loadTrackerState(session) {
  const result = await rpc(session, 'ark_tracker_get_state');
  return normalizeWeeklyPointsState(result?.data || {});
}

export async function saveTrackerState(session, data) {
  return rpc(session, 'ark_tracker_save_state', { p_data: normalizeWeeklyPointsState(data) });
}

export async function buyShopItem(session, itemId) {
  return rpc(session, 'ark_tracker_buy_shop_item', { p_item_id: itemId });
}

export async function uploadShopImage(session, file) {
  if (!file) return '';
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Only JPG, PNG or WEBP images are allowed.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be smaller than 2 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/ark-shop-images/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': file.type,
      'x-upsert': 'false',
    },
    body: file,
  });
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
