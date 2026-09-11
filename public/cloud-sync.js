(() => {
  'use strict';

  const STATE_KEY = 'ark-tracker-v1';
  const SESSION_KEY = 'ark-auth-session';
  const SUPABASE_URL = 'https://svdigxqdivcmljirjwhk.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2ZGlneHFkaXZjbWxqaXJqd2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTg3NDYsImV4cCI6MjEwMjg3NDc0Nn0.otGWq3hDPDKNAVHNvPkWHZhK7ezlSFZffEAcQlc0RzY';

  let cloudReady = false;
  let pendingValue = null;
  let saveTimer = null;
  const originalSetItem = Storage.prototype.setItem;

  function storeDirect(key, value) {
    originalSetItem.call(window.localStorage, key, value);
  }

  function sessionToken() {
    try {
      const session = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
      return session?.access_token || '';
    } catch (_) { return ''; }
  }

  function headers(extra = {}) {
    const token = sessionToken();
    if (!token) throw new Error('Missing ARK authenticated session.');
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async function fetchRemote() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ark_tracker_get_state`, {
      method: 'POST',
      headers: headers(),
      body: '{}',
      cache: 'no-store',
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    if (!response.ok) throw new Error(data?.message || `Cloud read failed: ${response.status}`);
    return data;
  }

  async function pushRaw(raw) {
    if (!raw) return false;
    let data;
    try { data = JSON.parse(raw); } catch (_) { return false; }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ark_tracker_save_state`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ p_data: data }),
    });
    const text = await response.text();
    let result = null;
    try { result = text ? JSON.parse(text) : null; } catch (_) { result = null; }
    if (!response.ok) throw new Error(result?.message || `Cloud save failed: ${response.status}`);
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

  function schedulePush(raw) {
    pendingValue = raw;
    if (!cloudReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const value = pendingValue;
      pendingValue = null;
      pushRaw(value).catch(error => {
        pendingValue = value;
        console.warn('[ARK Tracker] Cloud save failed.', error);
        notifyError(error);
      });
    }, 500);
  }

  if (!window.__ARK_STORAGE_PATCHED__) {
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      originalSetItem.call(this, key, value);
      if (this === window.localStorage && key === STATE_KEY) schedulePush(String(value));
    };
    window.__ARK_STORAGE_PATCHED__ = true;
  }

  async function initCloud() {
    if (!sessionToken()) {
      const error = new Error('Sign in is required for ARK Cloud.');
      notifyError(error);
      return;
    }
    const localRaw = window.localStorage.getItem(STATE_KEY);
    try {
      const remote = await fetchRemote();
      const remoteData = remote?.data;
      if (remoteData && typeof remoteData === 'object') {
        const remoteRaw = JSON.stringify(remoteData);
        if (remoteRaw !== localRaw) {
          storeDirect(STATE_KEY, remoteRaw);
          cloudReady = true;
          window.location.reload();
          return;
        }
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
    }
  }

  initCloud();
})();
