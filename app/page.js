'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CalendarDays, Check, ChevronDown, CirclePlus, Coins,
  LayoutDashboard, Minus, Plus, Save, Search,
  Settings2, ShieldCheck, Sparkles, Trash2, Trophy, UserCheck, Users, X, Medal, TrendingUp, Crown
} from 'lucide-react';

const DAY_PLAN = [
  { date: '2026-09-07', day: 'Mon', label: '7 Sep', rest: false },
  { date: '2026-09-08', day: 'Tue', label: '8 Sep', rest: false },
  { date: '2026-09-09', day: 'Wed', label: '9 Sep', rest: false },
  { date: '2026-09-10', day: 'Thu', label: '10 Sep', rest: false },
  { date: '2026-09-11', day: 'Fri', label: '11 Sep', rest: false },
  { date: '2026-09-12', day: 'Sat', label: '12 Sep', rest: false },
  { date: '2026-09-13', day: 'Sun', label: '13 Sep', rest: true },
  { date: '2026-09-14', day: 'Mon', label: '14 Sep', rest: false },
  { date: '2026-09-15', day: 'Tue', label: '15 Sep', rest: false },
  { date: '2026-09-16', day: 'Wed', label: '16 Sep', rest: false },
  { date: '2026-09-17', day: 'Thu', label: '17 Sep', rest: false },
  { date: '2026-09-18', day: 'Fri', label: '18 Sep', rest: false },
  { date: '2026-09-19', day: 'Sat', label: '19 Sep', rest: false },
  { date: '2026-09-20', day: 'Sun', label: '20 Sep', rest: true },
  { date: '2026-09-21', day: 'Mon', label: '21 Sep', rest: false },
  { date: '2026-09-22', day: 'Tue', label: '22 Sep', rest: false },
  { date: '2026-09-23', day: 'Wed', label: '23 Sep', rest: false },
  { date: '2026-09-24', day: 'Thu', label: '24 Sep', rest: false },
  { date: '2026-09-25', day: 'Fri', label: '25 Sep', rest: false },
  { date: '2026-09-26', day: 'Sat', label: '26 Sep', rest: false },
];

const MODULES = [
  { key: 'speaking' },
  { key: 'writing' },
  { key: 'reading' },
  { key: 'listening' },
];

const DEFAULT_GROUPS = ['IELTS', 'CEFR', '404'];

const seed = {
  students: [],
  records: {},
  taskLabels: {},
  groups: DEFAULT_GROUPS,
  liveLessons: { IELTS: 0, CEFR: 0, '404': 0 },
};

function loadState() {
  try {
    const raw = localStorage.getItem('ark-tracker-v1');
    return raw ? JSON.parse(raw) : seed;
  } catch {
    return seed;
  }
}

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

export default function Home() {
  const [tab, setTab] = useState('Overall');
  const [state, setState] = useState(seed);
  const [ready, setReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('2026-09-07');
  const [controlGroup, setControlGroup] = useState('IELTS');

  const groups = useMemo(() => {
    const saved = Array.isArray(state.groups) ? state.groups : [];
    const fromStudents = (state.students || []).map(s => s.group).filter(Boolean);
    return [...new Set([...DEFAULT_GROUPS, ...saved, ...fromStudents])];
  }, [state.groups, state.students]);

  useEffect(() => { setState(loadState()); setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem('ark-tracker-v1', JSON.stringify(state)); }, [state, ready]);

  useEffect(() => {
    if (groups.includes(tab)) setControlGroup(tab);
  }, [tab, groups]);

  const scoped = useMemo(() => {
    const list = state.students.filter(s => s.group === controlGroup);
    return list.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  }, [state.students, controlGroup, query]);

  const stats = useMemo(() => {
    const list = groups.includes(tab) ? state.students.filter(s => s.group === tab) : state.students;
    let present = 0, absent = 0, pts = 0, submitted = 0, totalTasks = 0;
    list.forEach(s => {
      pts += s.pts || 0;
      DAY_PLAN.forEach(d => {
        if (d.rest) return;
        const r = state.records?.[s.id]?.[d.date];
        if (r?.attendance === 'present') present++;
        if (r?.attendance === 'absent') absent++;
        MODULES.forEach(m => {
          totalTasks++;
          if (r?.modules?.[m.key]) submitted++;
        });
      });
    });
    return { students: list.length, present, absent, pts, submitted: pct(submitted, totalTasks) };
  }, [state, tab, groups]);

  const leaderboard = useMemo(() => {
    const list = groups.includes(tab) ? state.students.filter(s => s.group === tab) : state.students;
    return [...list].sort((a,b) => (b.pts||0)-(a.pts||0)).slice(0, 8);
  }, [state.students, tab, groups]);

  const dailyChart = useMemo(() => DAY_PLAN.map(d => {
    const list = groups.includes(tab) ? state.students.filter(s => s.group === tab) : state.students;
    if (d.rest) return { ...d, value: null, done: 0, possible: 0 };
    let done = 0, possible = list.length * 4;
    list.forEach(s => MODULES.forEach(m => { if (state.records?.[s.id]?.[d.date]?.modules?.[m.key]) done++; }));
    return { ...d, value: pct(done, possible), done, possible };
  }), [state, tab, groups]);

  const progressSummary = useMemo(() => {
    const lessonDays = dailyChart.filter(d => !d.rest);
    const finished = lessonDays.filter(d => d.possible > 0 && d.done === d.possible).length;
    const open = lessonDays.filter(d => d.possible > 0 && d.done < d.possible && d.done > 0);
    const untouched = lessonDays.filter(d => d.possible > 0 && d.done === 0).length;
    return { finished, open, untouched, lessonDays: lessonDays.length };
  }, [dailyChart]);

  const addStudent = (name, group) => {
    const clean = name.trim();
    if (!clean) return;
    setState(p => ({ ...p, students: [...p.students, { id: crypto.randomUUID(), name: clean, group, pts: 0 }] }));
    setShowAdd(false);
  };

  const addGroup = (name) => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return;
    const existing = groups.find(g => g.toLowerCase() === clean.toLowerCase());
    if (existing) {
      setTab(existing);
      setControlGroup(existing);
      setShowAddGroup(false);
      return;
    }
    setState(p => ({
      ...p,
      groups: [...new Set([...(Array.isArray(p.groups) ? p.groups : DEFAULT_GROUPS), clean])],
      liveLessons: { ...(p.liveLessons || {}), [clean]: p.liveLessons?.[clean] || 0 }
    }));
    setTab(clean);
    setControlGroup(clean);
    setShowAddGroup(false);
  };

  const removeStudent = (id) => setState(p => ({
    ...p,
    students: p.students.filter(s => s.id !== id),
    records: Object.fromEntries(Object.entries(p.records || {}).filter(([k]) => k !== id))
  }));

  const setAttendance = (id, date, value) => setState(p => {
    const oldDay = p.records?.[id]?.[date] || {};
    const current = oldDay.attendance;
    const { attendance: _attendance, ...withoutAttendance } = oldDay;
    const nextDay = current === value
      ? { ...withoutAttendance, modules: oldDay.modules || {} }
      : { ...oldDay, attendance: value, modules: oldDay.modules || {} };

    return {
      ...p,
      records: {
        ...(p.records || {}),
        [id]: {
          ...(p.records?.[id] || {}),
          [date]: nextDay
        }
      }
    };
  });

  const toggleModule = (id, date, key) => setState(p => ({
    ...p,
    records: {
      ...(p.records||{}),
      [id]: {
        ...(p.records?.[id]||{}),
        [date]: {
          ...(p.records?.[id]?.[date]||{}),
          modules: {
            ...(p.records?.[id]?.[date]?.modules||{}),
            [key]: !p.records?.[id]?.[date]?.modules?.[key]
          }
        }
      }
    }
  }));

  const setTaskLabel = (group, date, key, value) => setState(p => ({
    ...p,
    taskLabels: {
      ...(p.taskLabels || {}),
      [group]: {
        ...(p.taskLabels?.[group] || {}),
        [date]: {
          ...(p.taskLabels?.[group]?.[date] || {}),
          [key]: value
        }
      }
    }
  }));

  const addPts = (id, delta) => setState(p => ({
    ...p,
    students: p.students.map(s => s.id === id ? { ...s, pts: Math.max(0, (s.pts||0) + delta) } : s)
  }));

  const dateInfo = DAY_PLAN.find(d => d.date === selectedDate);
  const taskInputStyle = {
    width: 130,
    maxWidth: '100%',
    border: '1px solid #394550',
    outline: 0,
    background: '#18202a',
    color: '#eef2f5',
    borderRadius: 9,
    padding: '8px 9px',
    fontSize: 10,
    fontWeight: 750,
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><b>ARK</b><span>TRACKER</span></div></div>
        <nav>
          <button className={tab==='Overall'?'active':''} onClick={()=>setTab('Overall')}><LayoutDashboard size={18}/> Overall</button>
          {groups.map(group => {
            const Icon = group === 'IELTS' ? ShieldCheck : group === 'CEFR' ? BookOpen : Users;
            return <button key={group} className={tab===group?'active':''} onClick={()=>setTab(group)}><Icon size={18}/> {group}</button>;
          })}
          <button className={tab==='Leaderboard'?'active':''} onClick={()=>setTab('Leaderboard')}><Trophy size={18}/> Leaderboard</button>
        </nav>
        <div className="sidebar-note">
          <Sparkles size={17}/>
          <div><b>20-day cycle</b><span>Sunday = no lesson</span></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><span className="eyebrow">ARK EDUCATION</span><h1>{tab === 'Leaderboard' ? 'Leaderboard' : `${tab} Dashboard`}</h1><p>Learning progress, attendance and PTS.</p></div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
            <button className="view-all" style={{height:42,padding:'0 14px'}} onClick={()=>setShowAddGroup(true)}><Plus size={17}/> Add group</button>
            <button className="primary" onClick={()=>setShowAdd(true)}><CirclePlus size={18}/> Add student</button>
          </div>
        </header>

        {tab !== 'Leaderboard' ? <>
        <section className="kpis">
          <Kpi tone="blue" icon={Users} label="Students" value={stats.students} hint="active roster" />
          <Kpi tone="green" icon={UserCheck} label="Attendance" value={`${stats.present}/${stats.present+stats.absent}`} hint={`${stats.absent} absent`} />
          <Kpi tone="purple" icon={TrendingUp} label="Task progress" value={`${stats.submitted}%`} hint="daily assigned tasks" />
          <Kpi tone="gold" icon={Coins} label="Total PTS" value={stats.pts} hint="all earned points" />
        </section>

        <section className="overview-grid premium-grid">
          <div className="panel chart-panel premium-panel">
            <div className="panel-head results-head"><div><span className="eyebrow">20-DAY RESULTS</span><h2>Homework submitted</h2><div className="results-value">{stats.submitted}%</div><p className="results-copy">{progressSummary.finished} finished lesson days · {progressSummary.open.length} day{progressSummary.open.length===1?'':'s'} still open · {progressSummary.untouched} not started</p></div><div className="progress-badge"><TrendingUp size={16}/><b>{stats.submitted}%</b><span>overall</span></div></div>
            <ProgressChart data={dailyChart}/>
            <div className="chart-legend"><span><i className="legend-dot green"></i>Submitted progress</span><span><i className="legend-dot rest"></i>Sunday · no lesson</span></div>
          </div>

          <div className="panel leaderboard premium-panel">
            <div className="panel-head"><div><span className="eyebrow">TOP STUDENTS</span><h2>Leaderboard</h2></div><button className="view-all" onClick={()=>setTab('Leaderboard')}>View all <ChevronDown size={14}/></button></div>
            {leaderboard.length === 0 ? <Empty text="Add students to start the leaderboard."/> : <>
              <MiniPodium leaders={leaderboard.slice(0,3)}/>
              <div className="leader-list">{leaderboard.slice(3,8).map((s,i)=><LeaderRow key={s.id} student={s} rank={i+4}/>)}</div>
            </>}
          </div>
        </section>
        </> : <LeaderboardPage students={state.students}/>} 

        {tab !== 'Leaderboard' && <section className="panel tracker-panel">
          <div className="panel-head tracker-head">
            <div><span className="eyebrow">DAILY CONTROL</span><h2>Attendance & lesson analysis</h2><p className="section-subtitle">Showing <b>{controlGroup}</b> students only · switch group from the dropdown</p></div>
            <div className="controls">
              <label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${controlGroup} student`}/></label>
              <label className="select-wrap group-filter"><Users size={16}/><select value={controlGroup} onChange={e=>setControlGroup(e.target.value)}>{groups.map(group=><option key={group} value={group}>{group} group</option>)}</select><ChevronDown size={14}/></label>
              <label className="select-wrap"><CalendarDays size={16}/><select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}>{DAY_PLAN.map(d=><option key={d.date} value={d.date}>{d.label} · {d.day}{d.rest?' · No lesson':''}</option>)}</select><ChevronDown size={14}/></label>
            </div>
          </div>

          {dateInfo?.rest ? (
            <div className="rest-day"><CalendarDays size={26}/><div><b>{dateInfo.label} — Sunday</b><span>No lesson. Attendance and task analysis are disabled.</span></div></div>
          ) : scoped.length === 0 ? <Empty text="No students in this group yet. Add students and choose a group."/> : (
            <div className="table-wrap"><table><thead><tr><th>Student</th><th>Group</th><th>Attendance</th>{MODULES.map(m=><th key={m.key}><input aria-label={`Task ${m.key}`} style={taskInputStyle} value={state.taskLabels?.[controlGroup]?.[selectedDate]?.[m.key] || ''} onChange={e=>setTaskLabel(controlGroup,selectedDate,m.key,e.target.value)} placeholder="Vazifani yozing" /></th>)}<th>PTS</th><th></th></tr></thead><tbody>
              {scoped.map(s=>{
                const rec = state.records?.[s.id]?.[selectedDate] || {};
                return <tr key={s.id}><td><div className="student-cell"><div className="avatar">{s.name.slice(0,1).toUpperCase()}</div><b>{s.name}</b></div></td><td><span className={`group-tag ${s.group.toLowerCase()}`}>{s.group}</span></td><td><div className="attendance-buttons"><button className={rec.attendance==='present'?'present on':'present'} onClick={()=>setAttendance(s.id,selectedDate,'present')}><Check size={15}/> Present</button><button className={rec.attendance==='absent'?'absent on':'absent'} onClick={()=>setAttendance(s.id,selectedDate,'absent')}><X size={15}/> Absent</button></div></td>{MODULES.map(m=>{const on=!!rec.modules?.[m.key]; return <td key={m.key}><button className={on?'task-check done':'task-check'} onClick={()=>toggleModule(s.id,selectedDate,m.key)} aria-label={`${state.taskLabels?.[controlGroup]?.[selectedDate]?.[m.key] || 'Task'} ${on?'done':'not done'}`}>{on?<Check size={16}/>:<Minus size={16}/>}</button></td>})}<td><div className="pts-control"><button onClick={()=>addPts(s.id,-1)}><Minus size={14}/></button><strong>{s.pts||0}</strong><button onClick={()=>addPts(s.id,1)}><Plus size={14}/></button></div></td><td><button className="icon-danger" onClick={()=>removeStudent(s.id)} title="Delete"><Trash2 size={16}/></button></td></tr>
              })}
            </tbody></table></div>
          )}
        </section>}

        {tab !== 'Leaderboard' && <section className="schedule-grid">
          <div className="panel schedule-panel"><div className="panel-head"><div><span className="eyebrow">20-DAY PLAN</span><h2>Lesson calendar</h2></div></div><div className="calendar-grid">{DAY_PLAN.map(d=><button key={d.date} onClick={()=>setSelectedDate(d.date)} className={`${d.rest?'rest':''} ${selectedDate===d.date?'selected':''}`}><b>{d.label}</b><span>{d.rest?'No lesson':'Daily tasks'}</span></button>)}</div></div>
          <div className="panel live-panel"><div className="panel-head"><div><span className="eyebrow">LIVE LESSONS</span><h2>Weekly counters</h2></div><Settings2 size={20}/></div>{groups.map(group=><LiveCounter key={group} label={group} value={state.liveLessons?.[group]||0} setValue={(v)=>setState(p=>({...p,liveLessons:{...(p.liveLessons||{}),[group]:v}}))}/>)}<p className="muted">Set how many live lessons each group has per week. This is saved with tracker data.</p></div>
        </section>}
      </section>

      {showAdd && <AddModal groups={groups} onClose={()=>setShowAdd(false)} onAdd={addStudent}/>} 
      {showAddGroup && <AddGroupModal onClose={()=>setShowAddGroup(false)} onAdd={addGroup}/>} 
    </main>
  );
}

function Kpi({icon:Icon,label,value,hint,tone='blue'}) { return <div className={`kpi ${tone}`}><div className="kpi-icon"><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div><div className="kpi-orb"><Icon size={42}/></div></div> }
function ProgressChart({data}) {
  const w=760,h=240,pad=24; const step=(w-pad*2)/Math.max(1,data.length-1);
  const coords=data.map((d,i)=>({ x:pad+i*step, y:d.value==null?null:h-pad-(d.value/100)*(h-pad*2), ...d }));
  const segments=[]; let seg=[];
  coords.forEach(p=>{ if(p.y==null){ if(seg.length){segments.push(seg);seg=[];} } else seg.push(p); });
  if(seg.length) segments.push(seg);
  const pathFor=(arr)=>arr.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaFor=(arr)=>arr.length?`${pathFor(arr)} L${arr.at(-1).x.toFixed(1)},${h-pad} L${arr[0].x.toFixed(1)},${h-pad} Z`:'';
  return <div className="line-chart twenty-day-chart"><div className="chart-y"><span>100%</span><span>50%</span><span>0%</span></div><svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#50d49a" stopOpacity=".34"/><stop offset="100%" stopColor="#50d49a" stopOpacity=".01"/></linearGradient></defs><line x1={pad} x2={w-pad} y1={pad} y2={pad} className="grid-line"/><line x1={pad} x2={w-pad} y1={h/2} y2={h/2} className="grid-line"/><line x1={pad} x2={w-pad} y1={h-pad} y2={h-pad} className="grid-line"/>{coords.filter(p=>p.rest).map((p,i)=><g key={`rest-${i}`}><rect x={p.x-step*.42} y={pad} width={step*.84} height={h-pad*2} className="rest-band"/><line x1={p.x} x2={p.x} y1={pad} y2={h-pad} className="rest-line"/></g>)}{segments.map((arr,i)=><g key={i}><path d={areaFor(arr)} fill="url(#areaFill)"/><path d={pathFor(arr)} className="progress-line"/></g>)}{coords.filter(p=>p.y!=null).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.3" className="progress-dot"/>)}{coords.filter(p=>p.rest).map((p,i)=><circle key={`r-${i}`} cx={p.x} cy={h-pad} r="3" className="rest-dot"/>)}</svg><div className="chart-x twenty-labels">{data.map(d=><span key={d.date} className={d.rest?'rest-label':''}>{d.label.replace(' Sep','')}</span>)}</div></div>
}

function MiniPodium({leaders}) { const order=[leaders[1],leaders[0],leaders[2]].filter(Boolean); return <div className="mini-podium">{order.map((s,idx)=>{const rank=idx===0&&leaders[1]?2:idx===1?1:3; return <div className={`podium-card rank-${rank}`} key={s.id}><div className="podium-crown">{rank===1?<Crown size={18}/>:<Medal size={17}/>}</div><div className="podium-avatar">{s.name[0]?.toUpperCase()}</div><b>{s.name}</b><small>{s.group}</small><strong><Coins size={14}/>{s.pts||0}</strong><span className="place">#{rank}</span></div>})}</div> }
function LeaderRow({student:s,rank}) { return <div className="leader-row"><span className={`rank r${rank}`}>{rank}</span><div className="avatar">{s.name.slice(0,1).toUpperCase()}</div><div className="grow"><b>{s.name}</b><small>{s.group}</small></div><strong>{s.pts||0} <Coins size={14}/></strong></div> }
function LeaderboardPage({students}) { const list=[...students].sort((a,b)=>(b.pts||0)-(a.pts||0)); return <section className="leaderboard-page"><div className="leader-hero"><div><span className="eyebrow">ARK RANKING</span><h2>Student Leaderboard</h2><p>Points earned from attendance, lesson work and daily performance.</p></div><div className="hero-trophy"><Trophy size={34}/></div></div>{list.length===0?<div className="panel"><Empty text="Add students and start giving PTS to build the ranking."/></div>:<><div className="grand-podium"><MiniPodium leaders={list.slice(0,3)}/></div><div className="panel ranking-table"><div className="ranking-head"><span>Rank</span><span>Participant</span><span>Group</span><span>PTS</span></div>{list.map((s,i)=><div className={`ranking-row ${i===0?'winner':''}`} key={s.id}><span className="ranking-number">{i+1}</span><div className="participant"><div className="avatar">{s.name[0]?.toUpperCase()}</div><b>{s.name}</b></div><span className={`group-tag ${s.group.toLowerCase()}`}>{s.group}</span><strong><Coins size={15}/>{s.pts||0}</strong></div>)}</div></>}</section> }

function Empty({text}) { return <div className="empty"><Users size={30}/><b>Nothing here yet</b><span>{text}</span></div> }
function LiveCounter({label,value,setValue}) { return <div className="live-counter"><div><b>{label}</b><span>live lessons / week</span></div><div className="pts-control"><button onClick={()=>setValue(Math.max(0,value-1))}><Minus size={14}/></button><strong>{value}</strong><button onClick={()=>setValue(value+1)}><Plus size={14}/></button></div></div> }
function AddModal({groups,onClose,onAdd}) { const [name,setName]=useState(''); const [group,setGroup]=useState(groups[0] || 'IELTS'); return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NEW STUDENT</span><h2>Add to tracker</h2></div><button onClick={onClose}><X size={18}/></button></div><label>Student name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Muhammadali Karimov" onKeyDown={e=>{if(e.key==='Enter') onAdd(name,group)}}/></label><label>Group<select value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g} value={g}>{g}</option>)}</select></label><button className="primary full" onClick={()=>onAdd(name,group)}><Save size={17}/> Save student</button></div></div> }
function AddGroupModal({onClose,onAdd}) { const [name,setName]=useState(''); return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NEW GROUP</span><h2>Add group</h2></div><button onClick={onClose}><X size={18}/></button></div><label>Group name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. 909" onKeyDown={e=>{if(e.key==='Enter') onAdd(name)}}/></label><button className="primary full" onClick={()=>onAdd(name)}><Save size={17}/> Save group</button></div></div> }