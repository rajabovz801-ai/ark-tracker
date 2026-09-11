'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, ShieldCheck, UserCog, Users, X } from 'lucide-react';
import { STATE_KEY, listProfiles, updateProfile } from './arkAuthClient';

const ROLE_LABELS = {
  admin: 'Admin',
  teacher: 'Teacher',
  accountant: 'Accountant',
  shop_manager: 'Shop Manager',
  student: 'Student',
};

function readTracker() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function writeTracker(next) {
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('ark-tracker-state-updated', { detail: { source: 'access-center' } }));
}

export default function AccessCenter({ session, open, onClose, onCount }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const tracker = useMemo(() => readTracker(), [open]);
  const courses = tracker.courses || [{ id: 'english', name: 'English' }, { id: 'history', name: 'History' }];
  const groups = tracker.groups || [];
  const students = (tracker.students || []).filter(s => !s.archived);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const rows = await listProfiles(session);
      setProfiles(Array.isArray(rows) ? rows : []);
      const pending = (rows || []).filter(p => p.status === 'pending').length;
      onCount?.(pending);
    } catch (e) { setError(e.message || 'Could not load access requests.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const pending = profiles.filter(p => p.status === 'pending');
  const active = profiles.filter(p => p.status === 'active' && p.role !== 'owner');

  const draftFor = profile => drafts[profile.user_id] || {
    role: profile.role && profile.role !== 'pending' ? profile.role : 'teacher',
    courseId: profile.course_ids?.[0] || 'english',
    groups: profile.group_names || [],
    studentId: profile.student_id || '',
  };
  const patchDraft = (id, patch) => setDrafts(p => ({ ...p, [id]: { ...(draftFor(profiles.find(x => x.user_id === id) || {})), ...p[id], ...patch } }));

  const setStaffActive = (profile, activeValue) => {
    const raw = readTracker();
    const staff = Array.isArray(raw.staff) ? raw.staff : [];
    const id = `auth-${profile.user_id}`;
    let changed = false;
    const merged = staff.map(s => {
      if (s.id !== id && s.authUserId !== profile.user_id) return s;
      changed = true;
      return { ...s, active: activeValue };
    });
    if (changed) writeTracker({ ...raw, staff: merged });
  };

  const syncStaff = (profile, draft) => {
    const staffRoles = ['admin','teacher','accountant','shop_manager'];
    const raw = readTracker();
    const staff = Array.isArray(raw.staff) ? raw.staff : [];
    const id = `auth-${profile.user_id}`;

    if (!staffRoles.includes(draft.role)) {
      const merged = staff.map(s => (s.id === id || s.authUserId === profile.user_id) ? { ...s, active: false } : s);
      writeTracker({ ...raw, staff: merged });
      return;
    }

    const existing = staff.find(s => s.id === id || s.authUserId === profile.user_id);
    const next = {
      ...(existing || {}),
      id,
      name: profile.full_name || profile.email || existing?.name || 'Staff',
      role: draft.role,
      phone: existing?.phone || '',
      courseIds: draft.role === 'teacher' ? [draft.courseId] : courses.map(c => c.id),
      active: true,
      authUserId: profile.user_id,
    };
    const merged = [...staff.filter(s => s.id !== id && s.authUserId !== profile.user_id), next];
    writeTracker({ ...raw, staff: merged });
  };

  const approve = async profile => {
    const d = draftFor(profile);
    if (d.role === 'teacher' && !d.courseId) return setError('Choose a course for the teacher.');
    if (d.role === 'student' && !d.studentId) return setError('Link the account to a student first.');
    setLoading(true); setError('');
    try {
      await updateProfile(session, profile.user_id, {
        role: d.role,
        status: 'active',
        course_ids: d.role === 'teacher' ? [d.courseId] : [],
        group_names: d.role === 'teacher' ? d.groups : [],
        student_id: d.role === 'student' ? d.studentId : null,
      });
      syncStaff(profile, d);
      await load();
    } catch (e) { setError(e.message || 'Could not approve this account.'); }
    finally { setLoading(false); }
  };

  const reject = async profile => {
    setLoading(true); setError('');
    try {
      await updateProfile(session, profile.user_id, { role: 'pending', status: 'rejected', course_ids: [], group_names: [], student_id: null });
      setStaffActive(profile, false);
      await load();
    }
    catch (e) { setError(e.message || 'Could not reject this account.'); }
    finally { setLoading(false); }
  };

  const suspend = async profile => {
    setLoading(true); setError('');
    try {
      await updateProfile(session, profile.user_id, { status: 'suspended' });
      setStaffActive(profile, false);
      await load();
    }
    catch (e) { setError(e.message || 'Could not suspend this account.'); }
    finally { setLoading(false); }
  };

  if (!open) return null;
  return (
    <div className="access-backdrop" onMouseDown={onClose}>
      <section className="access-panel" onMouseDown={e => e.stopPropagation()}>
        <header className="access-head">
          <div><span className="eyebrow">OWNER CONTROL</span><h2>Access requests</h2><p>New accounts stay Pending until you choose a role.</p></div>
          <div className="row-actions"><button className="ghost" onClick={load}><RefreshCw size={15}/> Refresh</button><button className="icon-btn" onClick={onClose}><X size={17}/></button></div>
        </header>
        {error && <div className="auth-error">{error}</div>}

        <div className="access-section-title"><Users size={16}/><b>Pending</b><span>{pending.length}</span></div>
        <div className="access-list">
          {pending.map(profile => {
            const d = draftFor(profile);
            const courseGroups = groups.filter(g => (tracker.groupMeta?.[g]?.courseId || 'english') === d.courseId);
            return <article className="access-card" key={profile.user_id}>
              <div className="access-person"><div className="avatar">{(profile.full_name || profile.email || 'U')[0].toUpperCase()}</div><div><b>{profile.full_name || 'New user'}</b><span>{profile.email}</span></div></div>
              <div className="access-fields">
                <label><span>Role</span><select value={d.role} onChange={e => patchDraft(profile.user_id,{role:e.target.value})}>{Object.entries(ROLE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                {d.role === 'teacher' && <>
                  <label><span>Course</span><select value={d.courseId} onChange={e => patchDraft(profile.user_id,{courseId:e.target.value,groups:[]})}>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <label className="group-pick"><span>Groups</span><div>{courseGroups.map(g => <button type="button" key={g} className={d.groups.includes(g)?'on':''} onClick={()=>patchDraft(profile.user_id,{groups:d.groups.includes(g)?d.groups.filter(x=>x!==g):[...d.groups,g]})}>{g}</button>)}</div></label>
                </>}
                {d.role === 'student' && <label><span>Student profile</span><select value={d.studentId} onChange={e=>patchDraft(profile.user_id,{studentId:e.target.value})}><option value="">Choose student</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.group}</option>)}</select></label>}
              </div>
              <div className="access-actions"><button className="ghost danger" onClick={()=>reject(profile)}>Reject</button><button className="primary" onClick={()=>approve(profile)}><Check size={15}/> Approve</button></div>
            </article>;
          })}
          {!pending.length && <div className="access-empty"><ShieldCheck size={25}/><b>No pending requests</b><span>New registrations will appear here.</span></div>}
        </div>

        <div className="access-section-title"><UserCog size={16}/><b>Active accounts</b><span>{active.length}</span></div>
        <div className="active-accounts">
          {active.map(p => <div className="active-account" key={p.user_id}><div><b>{p.full_name || p.email}</b><span>{ROLE_LABELS[p.role] || p.role} · {p.email}</span></div><button className="ghost danger" onClick={()=>suspend(p)}>Suspend</button></div>)}
        </div>
        {loading && <div className="access-loading">Updating…</div>}
      </section>
    </div>
  );
}
