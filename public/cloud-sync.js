(() => {
  'use strict';

  const STATE_KEY = 'ark-tracker-v1';
  const SUPABASE_URL = 'https://svdigxqdivcmljirjwhk.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2ZGlneHFkaXZjbWxqaXJqd2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTg3NDYsImV4cCI6MjEwMjg3NDc0Nn0.otGWq3hDPDKNAVHNvPkWHZhK7ezlSFZffEAcQlc0RzY';
  const ENDPOINT = `${SUPABASE_URL}/rest/v1/ark_tracker_state`;

  let cloudReady = false;
  let pendingValue = null;
  let saveTimer = null;
  const originalSetItem = Storage.prototype.setItem;

  function storeDirect(key, value) {
    originalSetItem.call(window.localStorage, key, value);
  }

  function headers(extra = {}) {
    return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, ...extra };
  }

  async function fetchRemote() {
    const response = await fetch(`${ENDPOINT}?id=eq.main&select=data,updated_at`, {
      method: 'GET', headers: headers({ Accept: 'application/json' }), cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Cloud read failed: ${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function pushRaw(raw) {
    if (!raw) return false;
    let data;
    try { data = JSON.parse(raw); } catch (_) { return false; }
    const response = await fetch(`${ENDPOINT}?on_conflict=id`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ id: 'main', data, updated_at: new Date().toISOString() })
    });
    if (!response.ok) throw new Error(`Cloud save failed: ${response.status}`);
    return true;
  }

  function schedulePush(raw) {
    pendingValue = raw;
    if (!cloudReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const value = pendingValue;
      pendingValue = null;
      pushRaw(value).catch(() => { pendingValue = value; });
    }, 450);
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this === window.localStorage && key === STATE_KEY) schedulePush(String(value));
  };

  async function initCloud() {
    const localRaw = window.localStorage.getItem(STATE_KEY);
    try {
      const remote = await fetchRemote();
      if (remote && remote.data && typeof remote.data === 'object') {
        const remoteRaw = JSON.stringify(remote.data);
        if (remoteRaw !== localRaw) {
          storeDirect(STATE_KEY, remoteRaw);
          cloudReady = true;
          window.location.reload();
          return;
        }
        cloudReady = true;
        return;
      }
      cloudReady = true;
      if (localRaw) await pushRaw(localRaw);
    } catch (error) {
      cloudReady = false;
      console.warn('[ARK Tracker] Cloud sync unavailable; local data remains safe.', error);
    }
  }

  initCloud();
})();
