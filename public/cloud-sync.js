(() => {
  'use strict';

  const STATE_KEY = 'ark-tracker-v1';
  const ACCESS_KEY_STORAGE = 'ark-tracker-cloud-key';
  const SUPABASE_URL = 'https://svdigxqdivcmljirjwhk.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2ZGlneHFkaXZjbWxqaXJqd2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTg3NDYsImV4cCI6MjEwMjg3NDc0Nn0.otGWq3hDPDKNAVHNvPkWHZhK7ezlSFZffEAcQlc0RzY';
  const ENDPOINT = `${SUPABASE_URL}/rest/v1/ark_tracker_state`;

  let accessKey = '';
  let cloudReady = false;
  let pendingValue = null;
  let saveTimer = null;

  const originalSetItem = Storage.prototype.setItem;

  function storeDirect(key, value) {
    originalSetItem.call(window.localStorage, key, value);
  }

  function captureKeyFromHash() {
    try {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const key = params.get('arkkey');
      if (!key) return;
      storeDirect(ACCESS_KEY_STORAGE, key);
      accessKey = key;
      params.delete('arkkey');
      const nextHash = params.toString();
      history.replaceState(null, '', window.location.pathname + window.location.search + (nextHash ? `#${nextHash}` : ''));
    } catch (_) {}
  }

  captureKeyFromHash();
  accessKey = accessKey || window.localStorage.getItem(ACCESS_KEY_STORAGE) || '';

  function headers(extra = {}) {
    return {
      apikey: SUPABASE_ANON_KEY,
      'x-ark-tracker-key': accessKey,
      ...extra,
    };
  }

  async function fetchRemote() {
    const response = await fetch(`${ENDPOINT}?id=eq.main&select=data,updated_at`, {
      method: 'GET',
      headers: headers({ Accept: 'application/json' }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Cloud read failed: ${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function pushRaw(raw) {
    if (!accessKey || !raw) return false;

    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      return false;
    }

    const response = await fetch(`${ENDPOINT}?on_conflict=id`, {
      method: 'POST',
      headers: headers({
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify({
        id: 'main',
        data,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) throw new Error(`Cloud save failed: ${response.status}`);
    return true;
  }

  function schedulePush(raw) {
    pendingValue = raw;
    if (!cloudReady || !accessKey) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const value = pendingValue;
      pendingValue = null;
      pushRaw(value).catch(() => {
        pendingValue = value;
      });
    }, 350);
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this === window.localStorage && key === STATE_KEY) {
      schedulePush(String(value));
    }
  };

  async function initCloud() {
    if (!accessKey) {
      cloudReady = true;
      return;
    }

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
        if (pendingValue && pendingValue !== remoteRaw) {
          const latest = pendingValue;
          pendingValue = null;
          await pushRaw(latest);
        }
        return;
      }

      cloudReady = true;
      const firstValue = pendingValue || localRaw;
      pendingValue = null;
      if (firstValue) await pushRaw(firstValue);
    } catch (error) {
      cloudReady = false;
      console.warn('[ARK Tracker] Cloud sync unavailable; local data remains safe.', error);
    }
  }

  initCloud();
})();
