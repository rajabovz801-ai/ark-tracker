(() => {
  'use strict';

  const STATE_KEY = 'ark-tracker-v1';
  const SESSION_KEY = 'ark-auth-session';
  const SUPABASE_URL = 'https://svdigxqdivcmljirjwhk.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBiYXNlIiwicmVmIjoic3ZkaWd4cWRpdmNtbGppcmp3aGsiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NzI5ODc0NiwiZXhwIjoyMTAyODc0NzQ2fQ.otGWq3hDPDKNAVHNvPkWHZhK7ezlSFZffEAcQlc0RzY';
  const WEEKLY_POINTS_TIME_ZONE = 'Asia/Tashkent';

  let cloudReady = false;
  let pendingValue = null;
  let saveTimer = null;
  const originalSetItem = Storage.prototype.setItem;

  function storeDirect(key, value) {
    originalSetItem.call(window.localStorage, key, value);
  }

  function weeklyPointsCycleKey(at = new Date()) {
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

  function normalizeWeeklyPointsState(data, at = new Date()) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { data, changed: false };
    const cycle = weeklyPointsCycleKey(at);
    if (data.weeklyPointsCycle === cycle) return { data, changed: false };
    const students = (Array.isArray(data.students) ? data.students : []).map(student => ({ ...student, pts: 0 }));
    return {
      data: {
        ...data,
        students,
        weeklyPointsCycle: cycle,
        weeklyPointsResetAt: at.toISOString(),
      },
      changed: true,
    };
  }

  function normalizeRawState(raw) {
    try {
      const parsed = JSON.parse(String(raw || 'null'));
      return JSON.stringify(normalizeWeeklyPointsState(parsed).data);
    } catch (_) {
      return String(raw || '');
    }
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
    try { data = JSON.parse(normalizeRawState(raw)); } catch (_) { return false; }
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
    pendingValue = normalizeRawState(raw);
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
      if (this === window.localStorage && key === STATE_KEY) {
        const normalized = normalizeRawState(value);
        originalSetItem.call(this, key, normalized);
        schedulePush(normalized);
        return;
      }
      originalSetItem.call(this, key, value);
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
        const normalizedRemote = normalizeWeeklyPointsState(remoteData);
        const remoteRaw = JSON.stringify(normalizedRemote.data);
        if (normalizedRemote.changed) await pushRaw(remoteRaw);
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
