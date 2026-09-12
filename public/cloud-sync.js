(() => {
  'use strict';

  const STATE_KEY = 'ark-tracker-v1';
  const SESSION_KEY = 'ark-auth-session';
  const SUPABASE_URL = 'https://svdigxqdivcmljirjwhk.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InN2ZGlneHFkaXZjbWxqaXJqd2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTg3NDYsImV4cCI6MjEwMjg3NDc0Nn0.otGWq3hDPDKNAVHNvPkWHZhK7ezlSFZffEAcQlc0RzY';

  let cloudReady = false;
  let pendingValue = null;
  let saveTimer = null;
  let retryTimer = null;
  let lastRemoteUpdatedAt = null;
  let refreshing = null;
  const originalSetItem = Storage.prototype.setItem;

  function storeDirect(key, value) {
    originalSetItem.call(window.localStorage, key, value);
  }

  function readSession() {
    try { return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function writeSession(session) {
    storeDirect(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('ark-session-refreshed', { detail: { expires_at: session?.expires_at || 0 } }));
  }

  async function refreshSession() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const current = readSession();
      if (!current?.refresh_token) throw new Error('ARK session expired. Please sign in again.');
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
      if (!response.ok || !data?.access_token) throw new Error(data?.message || data?.error_description || 'Could not refresh ARK session.');
      const next = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || current.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
        user: data.user || current.user,
      };
      writeSession(next);
      return next;
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function freshSession() {
    const current = readSession();
    if (!current?.access_token) throw new Error('Missing ARK authenticated session.');
    if (Number(current.expires_at || 0) < Math.floor(Date.now() / 1000) + 120) return refreshSession();
    return current;
  }

  async function authedFetch(url, options = {}, retry = true) {
    let session = await freshSession();
    const make = token => fetch(url, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    let response = await make(session.access_token);
    if (response.status === 401 && retry) {
      session = await refreshSession();
      response = await make(session.access_token);
    }
    return response;
  }

  async function parse(response, fallback) {
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `${fallback}: ${response.status}`);
      error.status = response.status;
      error.code = data?.code || '';
      throw error;
    }
    return data;
  }

  async function fetchRemote() {
    const response = await authedFetch(`${SUPABASE_URL}/rest/v1/rpc/ark_tracker_get_state`, {
      method: 'POST', body: '{}', cache: 'no-store',
    });
    return parse(response, 'Cloud read failed');
  }

  async function pushRaw(raw) {
    if (!raw) return false;
    let data;
    try { data = JSON.parse(raw); } catch (_) { return false; }
    const payload = { p_data: data, p_base_updated_at: lastRemoteUpdatedAt || null };
    const response = await authedFetch(`${SUPABASE_URL}/rest/v1/rpc/ark_tracker_save_state_v2`, {
      method: 'POST', body: JSON.stringify(payload), cache: 'no-store',
    });
    const result = await parse(response, 'Cloud save failed');
    if (result?.updated_at) lastRemoteUpdatedAt = result.updated_at;
    return true;
  }

  function notifyReady() {
    window.__ARK_CLOUD_READY__ = true;
    window.dispatchEvent(new CustomEvent('ark-cloud-ready'));
  }

  function notifyError(error) {
    window.__ARK_CLOUD_READY__ = false;
    window.dispatchEvent(new CustomEvent('ark-cloud-error', { detail: { message: error?.message || 'Cloud sync unavailable.' } }));
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(async () => {
      if (!pendingValue || !navigator.onLine) return scheduleRetry();
      try {
        const value = pendingValue;
        await pushRaw(value);
        if (pendingValue === value) pendingValue = null;
        cloudReady = true;
        notifyReady();
      } catch (error) {
        if (String(error?.message || '').includes('STATE_CONFLICT')) return notifyError(new Error('Boshqa qurilmada yangi o‘zgarish bor. Ma’lumot yo‘qolmasligi uchun sahifani yangilang.'));
        scheduleRetry();
      }
    }, 4500);
  }

  function schedulePush(raw) {
    pendingValue = raw;
    if (!cloudReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const value = pendingValue;
      try {
        await pushRaw(value);
        if (pendingValue === value) pendingValue = null;
      } catch (error) {
        pendingValue = value;
        console.warn('[ARK Tracker] Cloud save failed.', error);
        if (String(error?.message || '').includes('STATE_CONFLICT')) {
          notifyError(new Error('Boshqa qurilmada yangi o‘zgarish bor. Ma’lumot yo‘qolmasligi uchun sahifani yangilang.'));
          return;
        }
        notifyError(error);
        scheduleRetry();
      }
    }, 550);
  }

  if (!window.__ARK_STORAGE_PATCHED__) {
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      originalSetItem.call(this, key, value);
      if (this === window.localStorage && key === STATE_KEY) schedulePush(String(value));
    };
    window.__ARK_STORAGE_PATCHED__ = true;
  }

  async function initCloud() {
    try {
      await freshSession();
      const localRaw = window.localStorage.getItem(STATE_KEY);
      const remote = await fetchRemote();
      lastRemoteUpdatedAt = remote?.updated_at || null;
      const remoteData = remote?.data;
      if (remoteData && typeof remoteData === 'object') {
        const remoteRaw = JSON.stringify(remoteData);
        if (remoteRaw !== localRaw) storeDirect(STATE_KEY, remoteRaw);
        cloudReady = true;
        notifyReady();
        return;
      }
      cloudReady = true;
      if (localRaw) await pushRaw(localRaw);
      notifyReady();
    } catch (error) {
      cloudReady = false;
      console.warn('[ARK Tracker] Role-aware cloud sync unavailable; local data was not deleted.', error);
      notifyError(error);
      scheduleRetry();
    }
  }

  window.addEventListener('online', () => {
    if (pendingValue) scheduleRetry();
    else if (!cloudReady) initCloud();
  });
  window.addEventListener('ark-session-refreshed', () => {
    if (!cloudReady) initCloud();
  });

  initCloud();
})();
