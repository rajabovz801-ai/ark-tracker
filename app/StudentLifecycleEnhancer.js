'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, CreditCard, Search, UserCheck, UserMinus, Users } from 'lucide-react';

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
  const dueDay = Math.max(1, Math.min(28, Number(student?.paymentDueDay || student?.paymentDay || 5)));
  const today = new Date().getDate();
  if (fee <= 0) return { key: 'none', label: 'To‘lov belgilanmagan', paid, fee };
  if (paid >= fee) return { key: 'paid', label: 'To‘langan', paid, fee };
  if (today >= dueDay) return { key: 'overdue', label: paid > 0 ? 'Qisman · kechikkan' : 'Qarzdor', paid, fee };
  return { key: paid > 0 ? 'partial' : 'pending', label: paid > 0 ? 'Qisman' : 'Kutilmoqda', paid, fee };
}

function prettyDate(value) {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('uz-UZ',{day:'numeric',month:'short',year:'numeric'}).format(d);
}

function Summary({ icon:Icon, label, value, tone='' }) {
  return <article className={`lifecycle-summary ${tone}`}><div><Icon size={19}/></div><span>{label}</span><strong>{value}</strong></article>;
}

function isStudentsPage(content) {
  const title = content.querySelector('.top-title h1')?.textContent?.trim().toLocaleLowerCase('uz-UZ') || '';
  if (title === 'students' || title === 'o‘quvchilar' || title === "o'quvchilar") return true;
  const activeNav = document.querySelector('.sidebar nav button.active')?.textContent?.trim().toLocaleLowerCase('uz-UZ') || '';
  return activeNav === 'students' || activeNav === 'o‘quvchilar' || activeNav === "o'quvchilar";
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

    const checkPage = () => setVisible(isStudentsPage(content));
    const onChange = event => {
      if (event.target?.matches?.('.course-switcher select')) setCourseId(event.target.value || 'all');
      checkPage();
    };
    const onStateUpdated = () => { sync(); checkPage(); };
    const observer = new MutationObserver(checkPage);
    observer.observe(content,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
    content.addEventListener('change',onChange,true);
    document.addEventListener('click',checkPage,true);
    window.addEventListener('storage',sync);
    window.addEventListener('ark-tracker-state-updated',onStateUpdated);
    checkPage();
    return () => {
      observer.disconnect();
      content.removeEventListener('change',onChange,true);
      document.removeEventListener('click',checkPage,true);
      window.removeEventListener('storage',sync);
      window.removeEventListener('ark-tracker-state-updated',onStateUpdated);
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
    return { counts, list };
  },[state,courseId,query,filter]);

  if (!allowed || !visible || !mount) return null;

  return createPortal(<section className="student-lifecycle-root">
    <div className="lifecycle-head">
      <div><span className="eyebrow">O‘QUVCHI HOLATI</span><h2>Holat va to‘lov nazorati</h2><p>Sinov, faol holat, ketganlar va to‘lov muddati shu yerda boshqariladi. Hisobotlar avtomatik yangilanadi.</p></div>
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
      <div className="lifecycle-grid lifecycle-header">
        <span>O‘quvchi</span><span>Holat</span><span>Sinov boshi</span><span>Sinov tugashi</span><span>To‘lov kuni</span><span>Oylik to‘lov</span><span>To‘lov holati</span><span>O‘zgargan sana</span>
      </div>
      {model.list.map(student => {
        const status = statusOf(student);
        const payment = paymentState(state,student);
        const dueDay = student.paymentDueDay || student.paymentDay || 5;
        return <div className={`lifecycle-grid lifecycle-row status-${status}`} key={student.id}>
          <div className="lifecycle-student" data-label="O‘quvchi"><div className="lifecycle-avatar">{student.name?.[0]?.toUpperCase()||'S'}</div><div><b>{student.name}</b><span>{student.group||'Guruh yo‘q'}</span></div></div>
          <label data-label="Holat"><select className={`lifecycle-status ${status}`} value={status} onChange={e=>changeStatus(student,e.target.value)}>{STATUSES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label data-label="Sinov boshi"><input type="date" value={student.trialStartedAt||''} onChange={e=>writeStudent(student.id,{trialStartedAt:e.target.value})}/></label>
          <label data-label="Sinov tugashi"><input type="date" value={student.trialUntil||''} onChange={e=>writeStudent(student.id,{trialUntil:e.target.value})}/></label>
          <label data-label="To‘lov kuni"><input className="due-day" type="number" min="1" max="28" value={dueDay} onChange={e=>{const value=Math.max(1,Math.min(28,Number(e.target.value||5)));writeStudent(student.id,{paymentDueDay:value,paymentDay:value})}}/></label>
          <label data-label="Oylik to‘lov"><input className="fee-input" type="number" min="0" step="10000" value={student.monthlyFee||''} onChange={e=>writeStudent(student.id,{monthlyFee:Math.max(0,Number(e.target.value||0))})} placeholder="0"/></label>
          <div data-label="To‘lov holati" className="lifecycle-payment"><span className={`payment-pill ${payment.key}`}>{payment.key==='paid'?<CheckCircle2 size={13}/>:payment.key==='overdue'?<AlertTriangle size={13}/>:<CreditCard size={13}/>} {payment.label}</span><small>{payment.paid?`${money(payment.paid)} / `:''}{payment.fee?money(payment.fee):''}</small></div>
          <div data-label="O‘zgargan sana" className="lifecycle-changed"><span>{prettyDate(student.lifecycleChangedAt)}</span>{student.leftAt?<small>Ketgan: {prettyDate(student.leftAt)}</small>:student.activatedAt?<small>Faol: {prettyDate(student.activatedAt)}</small>:null}</div>
        </div>;
      })}
      {!model.list.length && <div className="lifecycle-empty"><CalendarDays size={25}/><b>Bu filtr bo‘yicha o‘quvchi topilmadi.</b></div>}
    </div>
    <div className="lifecycle-footnote"><b>Qarzdor holati avtomatik.</b> To‘lov kuni yetib, joriy oy to‘lovi oylik summadan kam bo‘lsa, o‘quvchi qarzdor sifatida ko‘rsatiladi.</div>
  </section>,mount);
}
