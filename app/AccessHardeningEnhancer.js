'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { listProfiles, readSession, STATE_KEY, updateProfile } from './arkAuthClient';

function readTracker() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function writeTracker(next) {
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('ark-tracker-state-updated', { detail: { source: 'access-center' } }));
}

function reconcileStaff(profiles) {
  const tracker = readTracker();
  if (!tracker || typeof tracker !== 'object') return;
  const courses = Array.isArray(tracker.courses) ? tracker.courses : [];
  const groups = Array.isArray(tracker.groups) ? tracker.groups : [];
  const existingStaff = Array.isArray(tracker.staff) ? tracker.staff : [];
  let staff = [...existingStaff];
  const groupMeta = { ...(tracker.groupMeta || {}) };
  const authIds = new Set();

  for (const profile of profiles || []) {
    if (!profile?.user_id || profile.role === 'owner') continue;
    const id = `auth-${profile.user_id}`;
    authIds.add(id);
    const isStaff = ['admin','teacher','accountant','shop_manager'].includes(profile.role);
    const active = profile.status === 'active' && isStaff;
    const old = staff.find(item => item.id === id || item.authUserId === profile.user_id) || {};

    if (isStaff) {
      const courseIds = profile.role === 'teacher'
        ? (Array.isArray(profile.course_ids) && profile.course_ids.length ? profile.course_ids : old.courseIds || [])
        : courses.map(course => course.id);
      const next = {
        ...old,
        id,
        authUserId: profile.user_id,
        name: profile.full_name || profile.email || old.name || 'Xodim',
        role: profile.role,
        phone: old.phone || '',
        courseIds,
        groupNames: Array.isArray(profile.group_names) ? profile.group_names : [],
        active,
      };
      staff = [...staff.filter(item => item.id !== id && item.authUserId !== profile.user_id), next];
    } else if (old.id) {
      staff = staff.map(item => (item.id === id || item.authUserId === profile.user_id) ? { ...item, active: false } : item);
    }

    for (const group of groups) {
      const meta = { ...(groupMeta[group] || {}) };
      if (meta.teacherId === id && (!active || profile.role !== 'teacher' || !(profile.group_names || []).includes(group))) {
        meta.teacherId = '';
      }
      if (active && profile.role === 'teacher' && (profile.group_names || []).includes(group)) {
        meta.teacherId = id;
      }
      groupMeta[group] = meta;
    }
  }

  // Never keep an Auth-backed staff member active after the Auth profile disappears.
  staff = staff.map(item => item.authUserId && !authIds.has(item.id) ? { ...item, active: false } : item);

  const next = { ...tracker, staff, groupMeta };
  if (JSON.stringify(next.staff) !== JSON.stringify(tracker.staff) || JSON.stringify(next.groupMeta) !== JSON.stringify(tracker.groupMeta)) {
    writeTracker(next);
  }
}

export default function AccessHardeningEnhancer() {
  const [mount,setMount] = useState(null);
  const [profiles,setProfiles] = useState([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const role = typeof window !== 'undefined' ? window.__ARK_AUTH_PROFILE__?.role : null;
  const allowed = role === 'owner' || role === 'admin';

  const load = async () => {
    if (!allowed) return;
    const session = readSession();
    if (!session) return;
    setBusy(true); setError('');
    try {
      const rows = await listProfiles(session);
      const list = Array.isArray(rows) ? rows : [];
      setProfiles(list);
      reconcileStaff(list);
    } catch (e) {
      setError(e.message || 'Accountlarni yuklab bo‘lmadi.');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!allowed) return;
    let frame = 0;
    const locate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = document.querySelector('.access-panel');
        if (!panel) { setMount(null); return; }
        let host = panel.querySelector('[data-access-hardening-host="1"]');
        if (!host) {
          host = document.createElement('div');
          host.dataset.accessHardeningHost = '1';
          panel.appendChild(host);
          load();
        }
        setMount(host);
      });
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body,{subtree:true,childList:true});
    const sync = () => load();
    window.addEventListener('ark-tracker-state-updated',sync);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('ark-tracker-state-updated',sync);
    };
  },[allowed]);

  const suspended = useMemo(() => profiles.filter(profile => profile.status === 'suspended'),[profiles]);

  const activate = async profile => {
    const session = readSession();
    if (!session) return;
    setBusy(true); setError('');
    try {
      await updateProfile(session,profile.user_id,{status:'active'});
      await load();
    } catch (e) {
      setError(e.message || 'Accountni faollashtirib bo‘lmadi.');
      setBusy(false);
    }
  };

  if (!allowed || !mount) return null;
  return createPortal(<section className="access-hardening-section">
    <div className="access-section-title"><ShieldCheck size={16}/><b>To‘xtatilgan accountlar</b><span>{suspended.length}</span><button className="access-mini-refresh" onClick={load} disabled={busy}><RefreshCw size={13}/></button></div>
    {error && <div className="auth-error">{error}</div>}
    <div className="active-accounts">
      {suspended.map(profile => <div className="active-account" key={profile.user_id}>
        <div><b>{profile.full_name || profile.email}</b><span>{profile.role} · {profile.email}</span></div>
        <button className="ghost" disabled={busy} onClick={()=>activate(profile)}><RotateCcw size={14}/> Faollashtirish</button>
      </div>)}
      {!suspended.length && <div className="access-empty"><ShieldCheck size={22}/><b>To‘xtatilgan account yo‘q</b></div>}
    </div>
  </section>,mount);
}
