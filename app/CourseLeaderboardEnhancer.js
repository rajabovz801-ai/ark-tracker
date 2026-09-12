'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins, Crown, Medal, Trophy } from 'lucide-react';
import { courseOf, isActiveStudent, levelForXp } from './arkDomain.mjs';

const STATE_KEY='ark-tracker-v1';
const COURSE_KEY='ark-tracker-last-course';

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{return {}}}

function Row({student,rank}){
  return <div className="leader-row"><span className={`rank r${rank}`}>{rank}</span><div className="avatar">{student.name?.[0]?.toUpperCase()||'O'}</div><div className="grow"><b>{student.name}</b><small>{student.group||'—'} · {levelForXp(student.xp)}</small></div><strong>{Number(student.xp||0).toLocaleString()} XP</strong><span className="xp-wallet"><Coins size={12}/>{Number(student.pts||0).toLocaleString()}</span></div>;
}

function Podium({leaders}){
  const ordered=[leaders[1],leaders[0],leaders[2]].filter(Boolean);
  return <div className="mini-podium">{ordered.map((student,index)=>{
    const rank=student===leaders[0]?1:student===leaders[1]?2:3;
    return <div className={`podium-card rank-${rank}`} key={student.id}><div className="podium-crown">{rank===1?<Crown size={19}/>:<Medal size={18}/>}</div><div className="podium-avatar">{student.name?.[0]?.toUpperCase()||'O'}</div><b>{student.name}</b><span>{student.group||'—'} · {levelForXp(student.xp)}</span><strong>{Number(student.xp||0).toLocaleString()} XP</strong><small>{Number(student.pts||0).toLocaleString()} 🪙 · #{rank}</small></div>;
  })}</div>;
}

export default function CourseLeaderboardEnhancer(){
  const [mount,setMount]=useState(null);
  const [state,setState]=useState({});
  const [courseId,setCourseId]=useState('english');

  useEffect(()=>{
    const refresh=()=>{
      setState(readState());
      const profile=window.__ARK_AUTH_PROFILE__;
      const forced=profile?.role==='teacher'&&profile.course_ids?.length?profile.course_ids[0]:'';
      setCourseId(forced||localStorage.getItem(COURSE_KEY)||'english');
    };
    const locate=()=>{
      const shell=document.querySelector('.app-shell');
      const content=shell?.querySelector('.content');
      const visible=shell?.dataset?.pageKey==='Leaderboard';
      if(!shell||!content||!visible){shell?.classList.remove('xp-leaderboard-mode');setMount(null);return}
      shell.classList.add('xp-leaderboard-mode');
      let host=content.querySelector('[data-xp-leaderboard-host="1"]');
      if(!host){host=document.createElement('div');host.dataset.xpLeaderboardHost='1';host.className='xp-leaderboard-root';content.appendChild(host)}
      setMount(host);
    };
    refresh();locate();
    const observer=new MutationObserver(locate);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-page-key']});
    const onChange=()=>{refresh();locate()};
    window.addEventListener('ark-tracker-state-updated',onChange);
    window.addEventListener('ark-course-changed',onChange);
    window.addEventListener('ark-page-changed',onChange);
    return()=>{observer.disconnect();window.removeEventListener('ark-tracker-state-updated',onChange);window.removeEventListener('ark-course-changed',onChange);window.removeEventListener('ark-page-changed',onChange);document.querySelector('.app-shell')?.classList.remove('xp-leaderboard-mode')}
  },[]);

  const model=useMemo(()=>{
    const list=(state.students||[]).filter(student=>isActiveStudent(student)&&(courseId==='all'||courseOf(state,student)===courseId));
    list.sort((a,b)=>Number(b.xp||0)-Number(a.xp||0)||Number(b.pts||0)-Number(a.pts||0)||String(a.name||'').localeCompare(String(b.name||'')));
    const course=courseId==='all'?'Barcha kurslar':(state.courses||[]).find(course=>course.id===courseId)?.name||courseId;
    return {list,course};
  },[state,courseId]);

  if(!mount)return null;
  return createPortal(<div className="page-stack xp-leaderboard-page">
    <section className="leader-hero"><div><span className="eyebrow">ARK REYTING</span><h2>{model.course} · O‘quvchilar reytingi</h2><p>Reyting XP bo‘yicha. Coin sovg‘aga sarflansa ham XP va o‘rin kamaymaydi.</p></div><Trophy size={38}/></section>
    {model.list.length?<><Podium leaders={model.list.slice(0,3)}/><section className="panel"><div className="ranking-list">{model.list.map((student,index)=><Row key={student.id} student={student} rank={index+1}/>)}</div></section></>:<section className="panel"><div className="empty"><Trophy size={28}/><b>Hali reyting yo‘q</b><span>Bu kursga faol o‘quvchi qo‘shilganda reyting chiqadi.</span></div></section>}
  </div>,mount);
}
