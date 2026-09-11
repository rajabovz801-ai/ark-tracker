'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, BarChart3, BookOpen, CalendarDays, ChevronDown,
  CreditCard, GraduationCap, UserCheck, UserMinus, Users, Wallet
} from 'lucide-react';

const STATE_KEY = 'ark-tracker-v1';
const TASK_KEYS = ['speaking','writing','reading','listening'];

function readTracker() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString('en-US')} UZS`;
}

function lifecycle(student) {
  if (student?.lifecycleStatus) return student.lifecycleStatus;
  return student?.archived ? 'left_active' : 'active';
}

function scoreTask(value) {
  if (value === true || value === 'done') return 1;
  if (value === 'partial') return .5;
  return 0;
}

function courseOf(state, student) {
  return student?.courseId || state.groupMeta?.[student?.group]?.courseId || 'english';
}

function groupsFor(state, courseId) {
  const deleted = new Set(Array.isArray(state.deletedGroups) ? state.deletedGroups : []);
  const saved = Array.isArray(state.groups) ? state.groups : [];
  const fromStudents = (state.students || []).map(s => s.group).filter(Boolean);
  return [...new Set([...saved, ...fromStudents])]
    .filter(g => !deleted.has(g))
    .filter(g => courseId === 'all' || (state.groupMeta?.[g]?.courseId || 'english') === courseId);
}

function allRecordDates(state) {
  const set = new Set();
  Object.values(state.records || {}).forEach(byDate => Object.keys(byDate || {}).forEach(d => set.add(d)));
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  set.add(local);
  return [...set].sort().reverse();
}

function prettyDate(value) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(d);
}

function Kpi({icon:Icon,label,value,hint}) {
  return <article className="report-kpi"><div className="report-kpi-icon"><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></article>;
}

function Bar({label,value,max,suffix='',money=false,tone=''}) {
  const pct = max > 0 ? Math.max(value > 0 ? 4 : 0, Math.min(100,(value/max)*100)) : 0;
  return <div className={`report-bar-row ${tone}`}><div className="report-bar-label"><span>{label}</span><b>{money?fmtMoney(value):`${value}${suffix}`}</b></div><div className="report-bar-track"><span style={{width:`${pct}%`}}/></div></div>;
}

export default function ReportsEnhancer() {
  const [open,setOpen] = useState(false);
  const [state,setState] = useState({});
  const [courseId,setCourseId] = useState('all');
  const [date,setDate] = useState('');
  const [mount,setMount] = useState(null);
  const role = typeof window !== 'undefined' ? window.__ARK_AUTH_PROFILE__?.role : null;
  const allowed = role === 'owner' || role === 'admin';

  const refresh = () => {
    const next = readTracker();
    setState(next);
    const dates = allRecordDates(next);
    setDate(current => current && dates.includes(current) ? current : (dates[0] || ''));
  };

  useEffect(() => {
    if (!allowed) return;
    const shell = document.querySelector('.app-shell');
    const nav = shell?.querySelector('.sidebar nav');
    const content = shell?.querySelector('.content');
    if (!shell || !nav || !content) return;
    setMount(content);

    let btn = nav.querySelector('[data-ark-reports="1"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.arkReports = '1';
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16V5"/></svg><span>Reports</span>';
      const finance = [...nav.querySelectorAll('button')].find(x => x.textContent?.trim().startsWith('Finance'));
      if (finance?.nextSibling) nav.insertBefore(btn, finance.nextSibling); else nav.appendChild(btn);
    }

    const openReports = () => { refresh(); setOpen(true); };
    const closeFromNav = e => {
      const clicked = e.target.closest('button');
      if (clicked && clicked !== btn) setOpen(false);
    };
    btn.addEventListener('click',openReports);
    nav.addEventListener('click',closeFromNav,true);

    return () => {
      btn?.removeEventListener('click',openReports);
      nav.removeEventListener('click',closeFromNav,true);
    };
  },[allowed]);

  useEffect(() => {
    if (!allowed) return;
    const shell = document.querySelector('.app-shell');
    const nav = shell?.querySelector('.sidebar nav');
    const btn = nav?.querySelector('[data-ark-reports="1"]');
    if (!shell || !btn) return;
    if (open) {
      shell.classList.add('reports-mode');
      nav.querySelectorAll('button').forEach(x => x.classList.toggle('active',x===btn));
    } else {
      shell.classList.remove('reports-mode');
    }
    return () => shell.classList.remove('reports-mode');
  },[open,allowed]);

  useEffect(() => {
    if (!open) return;
    const onChange = () => refresh();
    window.addEventListener('ark-tracker-state-updated',onChange);
    window.addEventListener('storage',onChange);
    return () => {
      window.removeEventListener('ark-tracker-state-updated',onChange);
      window.removeEventListener('storage',onChange);
    };
  },[open]);

  const model = useMemo(() => {
    const courses = Array.isArray(state.courses) ? state.courses : [{id:'english',name:'English'},{id:'history',name:'History'}];
    const scopedAll = (state.students || []).filter(s => courseId === 'all' || courseOf(state,s) === courseId);
    const activeLike = scopedAll.filter(s => !s.archived && ['active','trial'].includes(lifecycle(s)));
    const active = scopedAll.filter(s => !s.archived && lifecycle(s) === 'active');
    const trial = scopedAll.filter(s => !s.archived && lifecycle(s) === 'trial');
    const leftActive = scopedAll.filter(s => lifecycle(s) === 'left_active');
    const trialLost = scopedAll.filter(s => lifecycle(s) === 'trial_lost');
    const groups = groupsFor(state,courseId);
    const month = monthKey();
    const today = new Date();
    const debtors = activeLike.filter(s => {
      const fee = Number(s.monthlyFee || 0);
      const paid = Number(state.payments?.[s.id]?.[month]?.amount || 0);
      const dueDay = Math.max(1,Math.min(28,Number(s.paymentDueDay || 5)));
      return fee > 0 && today.getDate() >= dueDay && paid < fee;
    });
    const paidStudents = activeLike.filter(s => Number(state.payments?.[s.id]?.[month]?.amount || 0) > 0);
    const expected = activeLike.reduce((sum,s)=>sum+Number(s.monthlyFee||0),0);
    const collected = activeLike.reduce((sum,s)=>sum+Number(state.payments?.[s.id]?.[month]?.amount||0),0);
    const outstanding = activeLike.reduce((sum,s)=>sum+Math.max(0,Number(s.monthlyFee||0)-Number(state.payments?.[s.id]?.[month]?.amount||0)),0);
    const dates = allRecordDates(state);
    const groupsDaily = groups.map(group => {
      const students = scopedAll.filter(s => !s.archived && s.group === group);
      let present=0,absent=0,score=0,possible=0;
      students.forEach(s => {
        const rec = state.records?.[s.id]?.[date] || {};
        if (rec.attendance === 'present') present++;
        if (rec.attendance === 'absent') absent++;
        TASK_KEYS.forEach(key => {
          const assigned = String(state.taskLabels?.[group]?.[date]?.[key] || '').trim();
          if (!assigned) return;
          possible++;
          score += scoreTask(rec.modules?.[key]);
        });
      });
      return {
        group,
        students: students.length,
        attendance: present+absent ? Math.round((present/(present+absent))*100) : 0,
        homework: possible ? Math.round((score/possible)*100) : 0,
      };
    });
    return {courses,scopedAll,active,trial,leftActive,trialLost,groups,debtors,paidStudents,expected,collected,outstanding,dates,groupsDaily};
  },[state,courseId,date]);

  if (!allowed || !open || !mount) return null;

  const lifecycleBars = [
    ['Active students',model.active.length],
    ['Trial students',model.trial.length],
    ['Debtors',model.debtors.length],
    ['Paid this month',model.paidStudents.length],
    ['Left active group',model.leftActive.length],
    ['Left after trial',model.trialLost.length],
  ];
  const lifecycleMax = Math.max(1,...lifecycleBars.map(x=>x[1]));
  const financeMax = Math.max(1,model.expected,model.collected,model.outstanding);

  return createPortal(<div className="reports-root">
    <header className="reports-topbar">
      <div><span className="eyebrow">ARK EDUCATION CENTRE</span><h1>Reports</h1><p>All management indicators in one place.</p></div>
      <div className="reports-filters">
        <label><GraduationCap size={16}/><select value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="all">All courses</option>{model.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={14}/></label>
        <label><CalendarDays size={16}/><select value={date} onChange={e=>setDate(e.target.value)}>{model.dates.map(d=><option key={d} value={d}>{prettyDate(d)}</option>)}</select><ChevronDown size={14}/></label>
      </div>
    </header>

    <main className="reports-stack">
      <section className="report-kpi-grid">
        <Kpi icon={Users} label="Active students" value={model.active.length} hint="currently studying"/>
        <Kpi icon={BookOpen} label="Groups" value={model.groups.length} hint="active structure"/>
        <Kpi icon={AlertTriangle} label="Debtors" value={model.debtors.length} hint="payment due"/>
        <Kpi icon={UserCheck} label="Trial students" value={model.trial.length} hint="trial period"/>
        <Kpi icon={CreditCard} label="Paid this month" value={model.paidStudents.length} hint="students with payment"/>
        <Kpi icon={UserMinus} label="Left active group" value={model.leftActive.length} hint="left after activation"/>
        <Kpi icon={Wallet} label="Left after trial" value={model.trialLost.length} hint="did not continue"/>
      </section>

      <section className="reports-grid two">
        <article className="report-panel">
          <div className="report-panel-head"><div><span className="eyebrow">STUDENT FLOW</span><h2>Student status</h2><p>All key counts are shown together.</p></div><BarChart3 size={22}/></div>
          <div className="report-bars">{lifecycleBars.map(([label,value])=><Bar key={label} label={label} value={value} max={lifecycleMax}/>)}</div>
        </article>
        <article className="report-panel">
          <div className="report-panel-head"><div><span className="eyebrow">CURRENT MONTH</span><h2>Finance overview</h2><p>Expected, received and outstanding tuition.</p></div><CreditCard size={22}/></div>
          <div className="report-bars money"><Bar label="Expected" value={model.expected} max={financeMax} money/><Bar label="Collected" value={model.collected} max={financeMax} money tone="good"/><Bar label="Outstanding" value={model.outstanding} max={financeMax} money tone="warn"/></div>
        </article>
      </section>

      <section className="report-panel daily-report">
        <div className="report-panel-head"><div><span className="eyebrow">DAILY GROUP REPORT</span><h2>{prettyDate(date)} · Group comparison</h2><p>Attendance and homework are calculated from Daily Control.</p></div><BarChart3 size={22}/></div>
        {model.groupsDaily.length ? <div className="group-performance">{model.groupsDaily.map(g=><article className="group-performance-card" key={g.group}><div className="group-performance-title"><div><b>{g.group}</b><span>{g.students} students</span></div></div><Bar label="Attendance" value={g.attendance} max={100} suffix="%" tone="good"/><Bar label="Homework" value={g.homework} max={100} suffix="%"/></article>)}</div> : <div className="reports-empty">No groups in this course yet.</div>}
      </section>
    </main>
  </div>,mount);
}
