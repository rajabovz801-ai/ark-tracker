'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, CreditCard, Search, UserCheck, UserMinus, Users } from 'lucide-react';
import { courseOf, cumulativeDebt, currentPaymentState, lifecycleStatus, localISODate, monthKey, paymentDueDay } from './arkDomain.mjs';

const STATE_KEY = 'ark-tracker-v1';
const COURSE_KEY = 'ark-tracker-last-course';
const STATUSES = [
  { value: 'active', label: 'Faol' },
  { value: 'trial', label: 'Sinov' },
  { value: 'left_active', label: 'Faol guruhdan ketgan' },
  { value: 'trial_lost', label: 'Sinovdan keyin ketgan' },
];

function readTracker() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function money(value) {
  return `${Number(value || 0).toLocaleString('en-US')} UZS`;
}

function prettyDate(value) {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('uz-UZ',{day:'numeric',month:'short',year:'numeric'}).format(d);
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
    const locate = () => {
      const shell = document.querySelector('.app-shell');
      const content = shell?.querySelector('.content');
      if (!shell || !content) return;
      setMount(content);
      setVisible(shell.dataset.pageKey === 'Students');
    };
    sync(); locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-page-key','class']});
    const onStateUpdated = () => { sync(); locate(); };
    window.addEventListener('storage',onStateUpdated);
    window.addEventListener('ark-tracker-state-updated',onStateUpdated);
    window.addEventListener('ark-course-changed',onStateUpdated);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage',onStateUpdated);
      window.removeEventListener('ark-tracker-state-updated',onStateUpdated);
      window.removeEventListener('ark-course-changed',onStateUpdated);
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
    if (refresh) setTimeout(()=>window.dispatchEvent(new CustomEvent('ark-tracker-state-updated',{detail:{source:'student-lifecycle'}})),0);
  };

  const changeStatus = (student, nextStatus) => {
    const previous = lifecycleStatus(student);
    const today = localISODate();
    const patch = {
      lifecycleStatus: nextStatus,
      lifecycleChangedAt: new Date().toISOString(),
      archived: nextStatus === 'left_active' || nextStatus === 'trial_lost',
    };
    if (nextStatus === 'trial') {
      patch.trialStartedAt = student.trialStartedAt || today;
      patch.leftAt = '';
      patch.paymentStart = student.paymentStart || '';
    }
    if (nextStatus === 'active') {
      patch.leftAt = '';
      patch.archived = false;
      if (previous === 'trial') {
        patch.activatedAt = today;
        patch.paymentStart = student.paymentStart || monthKey();
      }
    }
    if (nextStatus === 'left_active' || nextStatus === 'trial_lost') patch.leftAt = today;
    writeStudent(student.id,patch,true);
  };

  const model = useMemo(() => {
    const all = (state.students || []).filter(s => courseId === 'all' || courseOf(state,s) === courseId);
    const counts = { active:0, trial:0, left_active:0, trial_lost:0, debtors:0 };
    all.forEach(student => {
      const status = lifecycleStatus(student);
      if (counts[status] !== undefined) counts[status]++;
      if (status === 'active' && cumulativeDebt(state,student) > 0) counts.debtors++;
    });
    const list = all
      .filter(student => filter === 'all' || lifecycleStatus(student) === filter || (filter === 'debtors' && cumulativeDebt(state,student) > 0))
      .filter(student => `${student.name||''} ${student.group||''}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a,b) => {
        const order = { trial:0, active:1, left_active:2, trial_lost:3 };
        const diff = (order[lifecycleStatus(a)] ?? 9) - (order[lifecycleStatus(b)] ?? 9);
        return diff || String(a.name||'').localeCompare(String(b.name||''));
      });
    return { counts, list };
  },[state,courseId,query,filter]);

  if (!allowed || !visible || !mount) return null;

  return createPortal(<section className="student-lifecycle-root">
    <div className="lifecycle-head">
      <div><span className="eyebrow">O‘QUVCHI HOLATI</span><h2>Holat va to‘lov nazorati</h2><p>Sinov, faol holat, ketganlar va to‘lov muddati shu yerda boshqariladi. Sinovdagi o‘quvchi qarzdor hisoblanmaydi.</p></div>
      <div className="lifecycle-tools">
        <label className="lifecycle-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="O‘quvchi qidirish"/></label>
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Barcha holatlar</option>
          <option value="active">Faol</option>
          <option value="trial">Sinov</option>
          <option value="debtors">Qarzdorlar</option>
          <option value="left_active">Faol guruhdan ketganlar</option>
          <option value="trial_lost">Sinovdan keyin ketganlar</option>
        </select>
      </div>
    </div>

    <div className="lifecycle-summary-grid">
      <Summary icon={UserCheck} label="Faol" value={model.counts.active}/>
      <Summary icon={Clock3} label="Sinov" value={model.counts.trial} tone="trial"/>
      <Summary icon={AlertTriangle} label="Qarzdorlar" value={model.counts.debtors} tone="warn"/>
      <Summary icon={UserMinus} label="Faol guruhdan ketgan" value={model.counts.left_active}/>
      <Summary icon={Users} label="Sinovdan keyin ketgan" value={model.counts.trial_lost}/>
    </div>

    <div className="lifecycle-table-wrap">
      <div className="lifecycle-grid lifecycle-header lifecycle-grid-v2">
        <span>O‘quvchi</span><span>Holat</span><span>Sinov boshi</span><span>Sinov tugashi</span><span>To‘lov boshlanishi</span><span>To‘lov kuni</span><span>Oylik to‘lov</span><span>To‘lov holati</span><span>O‘zgargan sana</span>
      </div>
      {model.list.map(student => {
        const status = lifecycleStatus(student);
        const payment = currentPaymentState(state,student);
        const dueDay = paymentDueDay(student);
        return <div className={`lifecycle-grid lifecycle-row lifecycle-grid-v2 status-${status}`} key={student.id}>
          <div className="lifecycle-student" data-label="O‘quvchi"><div className="lifecycle-avatar">{student.name?.[0]?.toUpperCase()||'S'}</div><div><b>{student.name}</b><span>{student.group||'Guruh yo‘q'}</span></div></div>
          <label data-label="Holat"><select className={`lifecycle-status ${status}`} value={status} onChange={e=>changeStatus(student,e.target.value)}>{STATUSES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label data-label="Sinov boshi"><input type="date" value={student.trialStartedAt||''} onChange={e=>writeStudent(student.id,{trialStartedAt:e.target.value})}/></label>
          <label data-label="Sinov tugashi"><input type="date" value={student.trialUntil||''} onChange={e=>writeStudent(student.id,{trialUntil:e.target.value})}/></label>
          <label data-label="To‘lov boshlanishi"><input type="month" value={student.paymentStart||''} onChange={e=>writeStudent(student.id,{paymentStart:e.target.value})}/></label>
          <label data-label="To‘lov kuni"><input className="due-day" type="number" min="1" max="28" value={dueDay} onChange={e=>{const value=Math.max(1,Math.min(28,Number(e.target.value||5)));writeStudent(student.id,{paymentDueDay:value,paymentDay:value})}}/></label>
          <label data-label="Oylik to‘lov"><input className="fee-input" type="number" min="0" step="10000" value={student.monthlyFee||''} onChange={e=>writeStudent(student.id,{monthlyFee:Math.max(0,Number(e.target.value||0))})} placeholder="0"/></label>
          <div data-label="To‘lov holati" className="lifecycle-payment"><span className={`payment-pill ${payment.key}`}>{payment.key==='paid'?<CheckCircle2 size={13}/>:payment.key==='overdue'?<AlertTriangle size={13}/>:<CreditCard size={13}/>} {payment.label}</span><small>{payment.paid?`${money(payment.paid)} / `:''}{payment.fee?money(payment.fee):''}</small></div>
          <div data-label="O‘zgargan sana" className="lifecycle-changed"><span>{prettyDate(student.lifecycleChangedAt)}</span>{student.leftAt?<small>Ketgan: {prettyDate(student.leftAt)}</small>:student.activatedAt?<small>Faol: {prettyDate(student.activatedAt)}</small>:null}</div>
        </div>;
      })}
      {!model.list.length && <div className="lifecycle-empty"><CalendarDays size={25}/><b>Bu filtr bo‘yicha o‘quvchi topilmadi.</b></div>}
    </div>
    <div className="lifecycle-footnote"><b>Qarzdor holati avtomatik.</b> Faqat faol o‘quvchi uchun to‘lov boshlanganidan keyin va muddati o‘tganda qarz hisoblanadi.</div>
  </section>,mount);
}
