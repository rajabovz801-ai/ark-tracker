'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, BarChart3, BookOpen, CalendarDays, ChevronDown,
  CreditCard, GraduationCap, UserCheck, UserMinus, Users, Wallet
} from 'lucide-react';
import { courseOf, cumulativeDebt, currentPaymentState, isActiveStudent, lifecycleStatus, localISODate } from './arkDomain.mjs';

const STATE_KEY = 'ark-tracker-v1';
const TASK_KEYS = ['speaking','writing','reading','listening'];

function readTracker() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString('en-US')} UZS`;
}

function scoreTask(value) {
  if (value === true || value === 'done') return 1;
  if (value === 'partial') return .5;
  return 0;
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
  const set = new Set([localISODate()]);
  Object.values(state.records || {}).forEach(byDate => Object.keys(byDate || {}).forEach(d => set.add(d)));
  Object.values(state.taskLabels || {}).forEach(byDate => Object.keys(byDate || {}).forEach(d => set.add(d)));
  return [...set].sort().reverse();
}

function prettyDate(value) {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('uz-UZ',{day:'numeric',month:'short',year:'numeric'}).format(d);
}

function Kpi({icon:Icon,label,value,hint}) {
  return <article className="report-kpi"><div className="report-kpi-icon"><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></article>;
}

function Bar({label,value,max,suffix='',money=false,tone=''}) {
  const pct = max > 0 ? Math.max(value > 0 ? 4 : 0, Math.min(100,(value/max)*100)) : 0;
  return <div className={`report-bar-row ${tone}`}><div className="report-bar-label"><span>{label}</span><b>{money?fmtMoney(value):`${value}${suffix}`}</b></div><div className="report-bar-track"><span style={{width:`${pct}%`}}/></div></div>;
}

export default function ReportsEnhancer() {
  const [visible,setVisible] = useState(false);
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
    setDate(current => current && dates.includes(current) ? current : (dates[0] || localISODate()));
  };

  useEffect(() => {
    if (!allowed) return;
    const locate = () => {
      const shell = document.querySelector('.app-shell');
      const content = shell?.querySelector('.content');
      if (!shell || !content) return;
      setMount(content);
      setVisible(shell.dataset.pageKey === 'Reports');
    };
    refresh(); locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-page-key','class']});
    const onChange = () => { refresh(); locate(); };
    window.addEventListener('ark-tracker-state-updated',onChange);
    window.addEventListener('ark-course-changed',onChange);
    window.addEventListener('storage',onChange);
    return () => {
      observer.disconnect();
      window.removeEventListener('ark-tracker-state-updated',onChange);
      window.removeEventListener('ark-course-changed',onChange);
      window.removeEventListener('storage',onChange);
    };
  },[allowed]);

  useEffect(() => {
    if (!visible) return;
    const selected = localStorage.getItem('ark-tracker-last-course') || 'all';
    setCourseId(selected);
  },[visible]);

  const model = useMemo(() => {
    const courses = Array.isArray(state.courses) ? state.courses : [{id:'english',name:'English'},{id:'history',name:'History'}];
    const scopedAll = (state.students || []).filter(s => courseId === 'all' || courseOf(state,s) === courseId);
    const active = scopedAll.filter(isActiveStudent);
    const trial = scopedAll.filter(s => !s.archived && lifecycleStatus(s) === 'trial');
    const leftActive = scopedAll.filter(s => lifecycleStatus(s) === 'left_active');
    const trialLost = scopedAll.filter(s => lifecycleStatus(s) === 'trial_lost');
    const groups = groupsFor(state,courseId);
    const debtors = active.filter(s => cumulativeDebt(state,s) > 0);
    const paidStudents = active.filter(s => currentPaymentState(state,s).paid > 0);
    const expected = active.reduce((sum,s)=>sum+Math.max(0,Number(s.monthlyFee||0)),0);
    const collected = active.reduce((sum,s)=>sum+Math.max(0,Number(currentPaymentState(state,s).paid||0)),0);
    const outstanding = active.reduce((sum,s)=>sum+cumulativeDebt(state,s),0);
    const dates = allRecordDates(state);
    const groupsDaily = groups.map(group => {
      const students = active.filter(s => s.group === group);
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
    return {courses,active,trial,leftActive,trialLost,groups,debtors,paidStudents,expected,collected,outstanding,dates,groupsDaily};
  },[state,courseId,date]);

  if (!allowed || !visible || !mount) return null;

  const lifecycleBars = [
    ['Faol o‘quvchilar',model.active.length],
    ['Sinovdagi o‘quvchilar',model.trial.length],
    ['Qarzdorlar',model.debtors.length],
    ['Shu oy to‘laganlar',model.paidStudents.length],
    ['Faol guruhdan ketganlar',model.leftActive.length],
    ['Sinovdan keyin ketganlar',model.trialLost.length],
  ];
  const lifecycleMax = Math.max(1,...lifecycleBars.map(x=>x[1]));
  const financeMax = Math.max(1,model.expected,model.collected,model.outstanding);

  return createPortal(<div className="reports-root">
    <header className="reports-topbar">
      <div><span className="eyebrow">ARK EDUCATION CENTRE</span><h1>Hisobotlar</h1><p>Barcha boshqaruv ko‘rsatkichlari bir joyda.</p></div>
      <div className="reports-filters">
        <label><GraduationCap size={16}/><select value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="all">Barcha kurslar</option>{model.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={14}/></label>
        <label><CalendarDays size={16}/><select value={date} onChange={e=>setDate(e.target.value)}>{model.dates.map(d=><option key={d} value={d}>{prettyDate(d)}</option>)}</select><ChevronDown size={14}/></label>
      </div>
    </header>

    <main className="reports-stack">
      <section className="report-kpi-grid">
        <Kpi icon={Users} label="Faol o‘quvchilar" value={model.active.length} hint="hozir o‘qimoqda"/>
        <Kpi icon={BookOpen} label="Guruhlar" value={model.groups.length} hint="faol tuzilma"/>
        <Kpi icon={AlertTriangle} label="Qarzdorlar" value={model.debtors.length} hint="muddati o‘tgan qarz"/>
        <Kpi icon={UserCheck} label="Sinovdagi o‘quvchilar" value={model.trial.length} hint="sinov davri"/>
        <Kpi icon={CreditCard} label="Shu oy to‘laganlar" value={model.paidStudents.length} hint="to‘lov qilganlar"/>
        <Kpi icon={UserMinus} label="Faol guruhdan ketganlar" value={model.leftActive.length} hint="faollashgandan keyin"/>
        <Kpi icon={Wallet} label="Sinovdan keyin ketganlar" value={model.trialLost.length} hint="davom ettirmagan"/>
      </section>

      <section className="reports-grid two">
        <article className="report-panel">
          <div className="report-panel-head"><div><span className="eyebrow">O‘QUVCHILAR HARAKATI</span><h2>O‘quvchilar holati</h2><p>Barcha asosiy ko‘rsatkichlar bir joyda.</p></div><BarChart3 size={22}/></div>
          <div className="report-bars">{lifecycleBars.map(([label,value])=><Bar key={label} label={label} value={value} max={lifecycleMax}/>)}</div>
        </article>
        <article className="report-panel">
          <div className="report-panel-head"><div><span className="eyebrow">JORIY OY</span><h2>Moliya ko‘rinishi</h2><p>Faol o‘quvchilar bo‘yicha kutilgan, to‘langan va muddati o‘tgan qarz.</p></div><CreditCard size={22}/></div>
          <div className="report-bars money"><Bar label="Kutilgan" value={model.expected} max={financeMax} money/><Bar label="To‘langan" value={model.collected} max={financeMax} money tone="good"/><Bar label="Qarzdorlik" value={model.outstanding} max={financeMax} money tone="warn"/></div>
        </article>
      </section>

      <section className="report-panel daily-report">
        <div className="report-panel-head"><div><span className="eyebrow">KUNLIK GURUH HISOBOTI</span><h2>{prettyDate(date)} · Guruhlar taqqoslanishi</h2><p>Davomat va uy vazifasi Kunlik nazoratdan avtomatik hisoblanadi.</p></div><BarChart3 size={22}/></div>
        {model.groupsDaily.length ? <div className="group-performance">{model.groupsDaily.map(g=><article className="group-performance-card" key={g.group}><div className="group-performance-title"><div><b>{g.group}</b><span>{g.students} o‘quvchi</span></div></div><Bar label="Davomat" value={g.attendance} max={100} suffix="%" tone="good"/><Bar label="Uy vazifasi" value={g.homework} max={100} suffix="%"/></article>)}</div> : <div className="reports-empty">Bu kursda hali guruh yo‘q.</div>}
      </section>
    </main>
  </div>,mount);
}
