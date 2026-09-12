'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Medal, TrendingUp } from 'lucide-react';
import { continuousActivityDates, courseOf, dayMeta, isActiveStudent, isRestDate, levelForXp } from './arkDomain.mjs';

const STATE_KEY='ark-tracker-v1';
const COURSE_KEY='ark-tracker-last-course';
const KEYS=['speaking','writing','reading','listening'];

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{return {}}}
function taskScore(v){if(v===true||v==='done')return 1;if(v==='partial')return .5;return 0}

function dailyValue(state,students,date){
  let score=0,possible=0;
  students.forEach(s=>{
    const rec=state.records?.[s.id]?.[date]||{};
    KEYS.forEach(key=>{
      const assigned=String(state.taskLabels?.[s.group]?.[date]?.[key]||'').trim();
      if(!assigned)return;
      possible++;
      score+=taskScore(rec.modules?.[key]);
    });
  });
  return possible?Math.round((score/possible)*100):0;
}

function modelFrom(state){
  const courseId=localStorage.getItem(COURSE_KEY)||'english';
  const students=(state.students||[]).filter(s=>isActiveStudent(s)&&(courseId==='all'||courseOf(state,s)===courseId));
  const groups=[...new Set(students.map(s=>s.group).filter(Boolean))];
  const dates=continuousActivityDates(state,students.map(s=>s.id));
  let done=0,partial=0,notdone=0,totalScore=0,totalPossible=0;
  const bars=dates.map(date=>{
    const rest=isRestDate(state,date,groups);
    const value=rest?0:dailyValue(state,students,date);
    if(!rest){
      students.forEach(s=>{
        const rec=state.records?.[s.id]?.[date]||{};
        KEYS.forEach(key=>{
          if(!String(state.taskLabels?.[s.group]?.[date]?.[key]||'').trim())return;
          totalPossible++;
          const v=rec.modules?.[key];
          totalScore+=taskScore(v);
          if(v===true||v==='done')done++;else if(v==='partial')partial++;else if(v==='notdone')notdone++;
        });
      });
    }
    return {date,label:String(dayMeta(date).label.split(' ')[0]),rest,value};
  });
  const overall=totalPossible?Math.round((totalScore/totalPossible)*100):0;
  const leaders=[...students].sort((a,b)=>Number(b.xp||0)-Number(a.xp||0)||Number(b.pts||0)-Number(a.pts||0)||String(a.name||'').localeCompare(String(b.name||''))).slice(0,8);
  return {bars,overall,done,partial,notdone,leaders,courseId};
}

function PodiumCard({student,rank}){
  if(!student)return null;
  const level=levelForXp(student.xp).name;
  return <article className={`results-podium rank-${rank}`}>
    <span className="podium-rank">#{rank}</span>
    <div className="podium-medal">{rank===1?<Crown size={20}/>:<Medal size={19}/>}</div>
    <div className="results-avatar">{student.name?.[0]?.toUpperCase()||'O'}</div>
    <b title={student.name}>{student.name}</b><small>{student.group||'—'} · {level}</small><strong>{Number(student.xp||0)} XP</strong>
  </article>;
}

export default function ResultsBoardEnhancer(){
  const [mount,setMount]=useState(null);
  const [state,setState]=useState({});
  const refresh=()=>setState(readState());

  useEffect(()=>{
    refresh();
    const locate=()=>{
      const shell=document.querySelector('.app-shell');
      const isDashboard=shell?.dataset?.pageKey==='Dashboard';
      if(!isDashboard){setMount(null);return}
      const stack=shell?.querySelector('.content .page-stack');
      const kpis=stack?.querySelector('.kpi-grid');
      if(!stack||!kpis)return;
      let host=stack.querySelector('[data-results-board-host="1"]');
      if(!host){host=document.createElement('div');host.dataset.resultsBoardHost='1';kpis.insertAdjacentElement('afterend',host)}
      setMount(host);
    };
    locate();
    const obs=new MutationObserver(locate);
    obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-page-key']});
    const onState=()=>{refresh();setTimeout(locate,0)};
    window.addEventListener('ark-tracker-state-updated',onState);
    window.addEventListener('ark-course-changed',onState);
    window.addEventListener('storage',onState);
    return()=>{obs.disconnect();window.removeEventListener('ark-tracker-state-updated',onState);window.removeEventListener('ark-course-changed',onState);window.removeEventListener('storage',onState)};
  },[]);

  const model=useMemo(()=>modelFrom(state),[state]);
  if(!mount)return null;
  const podium=[model.leaders[1],model.leaders[0],model.leaders[2]];

  return createPortal(<section className="results-overview-grid">
    <article className="results-chart-card">
      <div className="results-chart-head">
        <div><span className="eyebrow">KUNLIK NATIJALAR</span><h2>Uy vazifasi topshirilishi</h2><strong className="results-big-percent">{model.overall}%</strong><p>{model.done} bajarilgan · {model.partial} qisman · {model.notdone} bajarilmagan</p></div>
        <div className="results-score-badge"><TrendingUp size={17}/><b>{model.overall}%</b><small>qisman = 50%</small></div>
      </div>
      <div className="results-bars-wrap dynamic-results">
        <div className="results-y-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
        <div className="results-bars" style={{gridTemplateColumns:`repeat(${Math.max(1,model.bars.length)}, minmax(28px, 1fr))`,minWidth:`${Math.max(640,model.bars.length*42)}px`}}>
          {model.bars.map(day=><div className={`results-day ${day.rest?'rest':''}`} key={day.date} title={dayMeta(day.date).label}>
            <b>{day.rest?'DAM':`${day.value}%`}</b>
            <div className="results-bar-track"><i style={{height:day.rest?'100%':`${Math.max(day.value>0?3:1,day.value)}%`}}/></div>
            <span>{day.label}</span>
          </div>)}
        </div>
      </div>
      <div className="results-legend"><span><i/>Topshirilgan natija</span><span className="rest-key"><i/>Dam olish kuni</span></div>
    </article>

    <article className="results-leader-card">
      <div className="results-leader-head"><div><span className="eyebrow">ENG YAXSHI O‘QUVCHILAR</span><h2>Reyting</h2></div></div>
      <div className="results-podium-grid"><PodiumCard student={podium[0]} rank={2}/><PodiumCard student={podium[1]} rank={1}/><PodiumCard student={podium[2]} rank={3}/></div>
      <div className="results-leader-list">{model.leaders.slice(3).map((s,i)=><div className="results-leader-row" key={s.id}><span>{i+4}</span><div className="results-avatar small">{s.name?.[0]?.toUpperCase()||'O'}</div><div><b>{s.name}</b><small>{s.group||'—'} · {levelForXp(s.xp).name}</small></div><strong>{Number(s.xp||0)} XP</strong></div>)}</div>
    </article>
  </section>,mount);
}
