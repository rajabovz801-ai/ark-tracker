'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, CreditCard, Search, UserCheck, UserMinus, Users } from 'lucide-react';

const STATE_KEY = 'ark-tracker-v1';
const COURSE_KEY = 'ark-tracker-last-course';
const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'left_active', label: 'Left active group' },
  { value: 'trial_lost', label: 'Left after trial' },
];

function readTracker() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function statusOf(student) {
  if (student?.lifecycleStatus) return student.lifecycleStatus;
  return student?.archived ? 'left_active' : 'active';
}

function courseOf(state, student) {
  return student?.courseId || state.groupMeta?.[student?.group]?.courseId || 'english';
}

function money(value) {
  return `${Number(value || 0).toLocaleString('en-US')} UZS`;
}

function paymentState(state, student) {
  const fee = Number(student?.monthlyFee || 0);
  const paid = Number(state.payments?.[student?.id]?.[monthKey()]?.amount || 0);
  const dueDay = Math.max(1, Math.min(28, Number(student?.paymentDueDay || 5)));
  const today = new Date().getDate();
  if (fee <= 0) return { key: 'none', label: 'No fee', paid, fee };
  if (paid >= fee) return { key: 'paid', label: 'Paid', paid, fee };
  if (today >= dueDay) return { key: 'overdue', label: paid > 0 ? 'Partial · overdue' : 'Overdue', paid, fee };
  return { key: paid > 0 ? 'partial' : 'pending', label: paid > 0 ? 'Partial' : 'Pending', paid, fee };
}

function prettyDate(value) {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(d);
}

function Summary({ icon:Icon, label, value, tone='' }) {
  return <article className={`lifecycle-summary ${tone}`}><div><Icon size={19}/></div><span>{label}</span><strong>{value}</strong></article>;
}

export default function StudentLifecycleEnhancer() {
  const [mount,setMount] = useState(null);
  const [visible,setVisible] = useState(false);
  const [state,setState] = useState({});
  const [courseId,setCourseId] = useState('all');
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('all');
  const role = typeof window !== 'undefined' ? window.__ARK_AUTH_PROFILE__?.role : null;
  const allowed = role === 'owner' || role === 'admin';

  const sync = () => {
    setState(readTracker());
    setCourseId(localStorage.getItem(COURSE_KEY) || 'all');
  };

  useEffect(() => {
    if (!allowed) return;
    const content = document.querySelector('.app-shell .content');
    if (!content) return;
    setMount(content);
    sync();

    const checkPage = () => {
      const title = content.querySelector('.top-title h1')?.textContent?.trim();
      setVisible(title === 'Students');
    };
    const onChange = event => {
      if (event.target?.matches?.('.course-switcher select')) setCourseId(event.target.value || 'all');
      checkPage();
    };
    const observer = new MutationObserver(checkPage);
    observer.observe(content,{subtree:true,childList:true,characterData:true});
    content.addEventListener('change',onChange,true);
    window.addEventListener('storage',sync);
    checkPage();
    return () => {
      observer.disconnect();
      content.removeEventListener('change',onChange,true);
      window.removeEventListener('storage',sync);
    };
  },[allowed]);

  const writeStudent = (studentId, patch, refresh=false) => {
    const latest = readTracker();
    const next = {
      ...latest,
      students: (latest.students || []).map(student => student.id === studentId ? { ...student, ...patch } : student),
    };
    localStorage.setItem(STATE_KEY,JSON.stringify(next));
    setState(next);
    if (refresh) setTimeout(()=>window.dispatchEvent(new CustomEvent('ark-tracker-state-updated')),0);
  };

  const changeStatus = (student, nextStatus) => {
    const previous = statusOf(student);
    const today = localDate();
    const patch = {
      lifecycleStatus: nextStatus,
      lifecycleChangedAt: new Date().toISOString(),
      archived: nextStatus === 'left_active' || nextStatus === 'trial_lost',
    };
    if (nextStatus === 'trial') {
      patch.trialStartedAt = student.trialStartedAt || today;
      patch.leftAt = '';
    }
    if (nextStatus === 'active') {
      patch.leftAt = '';
      if (previous === 'trial') patch.activatedAt = today;
    }
    if (nextStatus === 'left_active' || nextStatus === 'trial_lost') patch.leftAt = today;
    writeStudent(student.id,patch,true);
  };

  const model = useMemo(() => {
    const all = (state.students || []).filter(s => courseId === 'all' || courseOf(state,s) === courseId);
    const counts = { active:0, trial:0, left_active:0, trial_lost:0, debtors:0 };
    all.forEach(student => {
      const status = statusOf(student);
      if (counts[status] !== undefined) counts[status]++;
      if ((status === 'active' || status === 'trial') && paymentState(state,student).key === 'overdue') counts.debtors++;
    });
    const list = all
      .filter(student => filter === 'all' || statusOf(student) === filter || (filter === 'debtors' && paymentState(state,student).key === 'overdue'))
      .filter(student => `${student.name||''} ${student.group||''} ${student.parentName||''}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a,b) => {
        const order = { trial:0, active:1, left_active:2, trial_lost:3 };
        const diff = (order[statusOf(a)] ?? 9) - (order[statusOf(b)] ?? 9);
        return diff || String(a.name||'').localeCompare(String(b.name||''));
      });
    return { all, counts, list };
  },[state,courseId,query,filter]);

  if (!allowed || !visible || !mount) return null;

  return createPortal(<section className="student-lifecycle-root">
    <div className="lifecycle-head">
      <div><span className="eyebrow">STUDENT LIFECYCLE</span><h2>Status & billing control</h2><p>Trial, active, departures and payment due dates are managed here. Reports update automatically.</p></div>
      <div className="lifecycle-tools">
        <label className="lifecycle-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search student"/></label>
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="debtors">Debtors</option>
          <option value="left_active">Left active group</option>
          <option value="trial_lost">Left after trial</option>
        </select>
      </div>
    </div>

    <div className="lifecycle-summary-grid">
      <Summary icon={UserCheck} label="Active" value={model.counts.active}/>
      <Summary icon={Clock3} label="Trial" value={model.counts.trial} tone="trial"/>
      <Summary icon={AlertTriangle} label="Debtors" value={model.counts.debtors} tone="warn"/>
      <Summary icon={UserMinus} label="Left active" value={model.counts.left_active}/>
      <Summary icon={Users} label="Left after trial" value={model.counts.trial_lost}/>
    </div>

    <div className="lifecycle-table-wrap">
      <div className="lifecycle-grid lifecycle-header">
        <span>Student</span><span>Status</span><span>Trial start</span><span>Trial until</span><span>Due day</span><span>Monthly fee</span><span>Payment</span><span>Changed</span>
      </div>
      {model.list.map(student => {
        const status = statusOf(student);
        const payment = paymentState(state,student);
        return <div className={`lifecycle-grid lifecycle-row status-${status}`} key={student.id}>
          <div className="lifecycle-student" data-label="Student"><div className="lifecycle-avatar">{student.name?.[0]?.toUpperCase()||'S'}</div><div><b>{student.name}</b><span>{student.group||'No group'}</span></div></div>
          <label data-label="Status"><select className={`lifecycle-status ${status}`} value={status} onChange={e=>changeStatus(student,e.target.value)}>{STATUSES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label data-label="Trial start"><input type="date" value={student.trialStartedAt||''} onChange={e=>writeStudent(student.id,{trialStartedAt:e.target.value})}/></label>
          <label data-label="Trial until"><input type="date" value={student.trialUntil||''} onChange={e=>writeStudent(student.id,{trialUntil:e.target.value})}/></label>
          <label data-label="Due day"><input className="due-day" type="number" min="1" max="28" value={student.paymentDueDay||5} onChange={e=>writeStudent(student.id,{paymentDueDay:Math.max(1,Math.min(28,Number(e.target.value||5)))})}/></label>
          <label data-label="Monthly fee"><input className="fee-input" type="number" min="0" step="10000" value={student.monthlyFee||''} onChange={e=>writeStudent(student.id,{monthlyFee:Math.max(0,Number(e.target.value||0))})} placeholder="0"/></label>
          <div data-label="Payment" className="lifecycle-payment"><span className={`payment-pill ${payment.key}`}>{payment.key==='paid'?<CheckCircle2 size={13}/>:payment.key==='overdue'?<AlertTriangle size={13}/>:<CreditCard size={13}/>} {payment.label}</span><small>{payment.paid?`${money(payment.paid)} / `:''}{payment.fee?money(payment.fee):''}</small></div>
          <div data-label="Changed" className="lifecycle-changed"><span>{prettyDate(student.lifecycleChangedAt)}</span>{student.leftAt?<small>Left: {prettyDate(student.leftAt)}</small>:student.activatedAt?<small>Active: {prettyDate(student.activatedAt)}</small>:null}</div>
        </div>;
      })}
      {!model.list.length && <div className="lifecycle-empty"><CalendarDays size={25}/><b>No students match this filter.</b></div>}
    </div>
    <div className="lifecycle-footnote"><b>Debtor is automatic.</b> A student becomes overdue when the payment due day arrives and the current month payment is below the monthly fee.</div>
  </section>,mount);
}
