'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins, Crown, Medal, TrendingUp, Trophy, Users } from 'lucide-react';

const STATE_KEY = 'ark-tracker-v1';
const COURSE_KEY = 'ark-tracker-last-course';

const LEVELS = [
  { name: 'Starter', min: 0, next: 500, nextName: 'Bronze', tone: 'starter' },
  { name: 'Bronze', min: 500, next: 1500, nextName: 'Silver', tone: 'bronze' },
  { name: 'Silver', min: 1500, next: 3000, nextName: 'Gold', tone: 'silver' },
  { name: 'Gold', min: 3000, next: 5000, nextName: 'Diamond', tone: 'gold' },
  { name: 'Diamond', min: 5000, next: null, nextName: null, tone: 'diamond' },
];

function parseState(raw) {
  try { return JSON.parse(raw || '{}'); }
  catch { return {}; }
}

function courseOf(state, student) {
  return student.courseId || state.groupMeta?.[student.group]?.courseId || 'english';
}

function levelMeta(xpValue) {
  const xp = Math.max(0, Number(xpValue || 0));
  return [...LEVELS].reverse().find(level => xp >= level.min) || LEVELS[0];
}

function levelProgress(xpValue) {
  const xp = Math.max(0, Number(xpValue || 0));
  const level = levelMeta(xp);
  if (!level.next) return 100;
  const span = Math.max(1, level.next - level.min);
  return Math.max(0, Math.min(100, Math.round(((xp - level.min) / span) * 100)));
}

function metricValue(student, mode) {
  return mode === 'xp' ? Number(student.xp || 0) : Number(student.pts || 0);
}

function metricLabel(mode) {
  return mode === 'xp' ? 'XP' : 'pts';
}

function StatCard({ icon: Icon, label, value, hint }) {
  return <article className="ark-lb-stat">
    <div className="ark-lb-stat-icon"><Icon size={19}/></div>
    <div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>
  </article>;
}

function PodiumCard({ student, rank, mode }) {
  if (!student) return null;
  const level = levelMeta(student.xp);
  const value = metricValue(student, mode);
  return <article className={`ark-lb-podium-card ark-lb-rank-${rank}`}>
    <div className="ark-lb-podium-top">
      <span>#{rank}</span>
      {rank === 1 ? <Crown size={22}/> : <Medal size={20}/>} 
    </div>
    <div className="ark-lb-podium-avatar">{String(student.name || 'S')[0].toUpperCase()}</div>
    <h3 title={student.name}>{student.name}</h3>
    <p>{student.group || '—'}</p>
    <span className={`ark-lb-level ark-lb-level-${level.tone}`}>{level.name}</span>
    <strong>{value.toLocaleString()} <small>{metricLabel(mode)}</small></strong>
  </article>;
}

function RankingRow({ student, rank, mode, weeklyMax }) {
  const xp = Number(student.xp || 0);
  const value = metricValue(student, mode);
  const level = levelMeta(xp);
  const xpPct = levelProgress(xp);
  const progress = mode === 'xp'
    ? xpPct
    : weeklyMax > 0 ? Math.round((value / weeklyMax) * 100) : 0;
  const progressText = mode === 'xp'
    ? (level.next ? `${Math.max(0, level.next - xp)} XP to ${level.nextName}` : 'Highest level reached')
    : `${value.toLocaleString()} weekly points`;

  return <div className="ark-lb-row">
    <div className={`ark-lb-row-rank ark-lb-row-rank-${rank}`}>{rank}</div>
    <div className="ark-lb-row-avatar">{String(student.name || 'S')[0].toUpperCase()}</div>
    <div className="ark-lb-row-student">
      <b>{student.name}</b>
      <span>{student.group || '—'}</span>
    </div>
    <div className="ark-lb-row-level">
      <span className={`ark-lb-level ark-lb-level-${level.tone}`}>{level.name}</span>
      <small>{xp.toLocaleString()} lifetime XP</small>
    </div>
    <div className="ark-lb-row-progress">
      <div className="ark-lb-progress-track"><i style={{ width: `${progress}%` }}/></div>
      <small>{progressText}</small>
    </div>
    <div className="ark-lb-row-score">
      <strong>{value.toLocaleString()}</strong>
      <span>{metricLabel(mode)}</span>
    </div>
  </div>;
}

export default function GroupLeaderboardEnhancer() {
  const [mount, setMount] = useState(null);
  const [state, setState] = useState({});
  const [courseId, setCourseId] = useState('english');
  const [group, setGroup] = useState('all');
  const [mode, setMode] = useState('xp');
  const rawRef = useRef('');
  const courseRef = useRef('');

  useEffect(() => {
    const refreshData = () => {
      const raw = localStorage.getItem(STATE_KEY) || '{}';
      const course = localStorage.getItem(COURSE_KEY) || 'english';
      if (raw !== rawRef.current) {
        rawRef.current = raw;
        setState(parseState(raw));
      }
      if (course !== courseRef.current) {
        courseRef.current = course;
        setCourseId(course);
      }
    };

    const clearLeaderboardMount = () => {
      document.querySelectorAll('.ark-core-leaderboard-hidden').forEach(node => node.classList.remove('ark-core-leaderboard-hidden'));
      document.querySelectorAll('[data-group-leaderboard-host="1"]').forEach(node => node.remove());
      setMount(null);
    };

    const locate = () => {
      const shell = document.querySelector('.app-shell');
      const active = shell?.querySelector('.sidebar nav button.active')?.textContent?.trim().toLowerCase() || '';
      const isLeaderboard = active.includes('leaderboard') || active.includes('reyting');
      if (!isLeaderboard) {
        clearLeaderboardMount();
        return;
      }

      const content = shell?.querySelector('.content');
      const stack = content?.querySelector('.page-stack');
      if (!content || !stack) return;

      stack.classList.add('ark-core-leaderboard-hidden');
      let host = content.querySelector('[data-group-leaderboard-host="1"]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.groupLeaderboardHost = '1';
        stack.insertAdjacentElement('afterend', host);
      }
      setMount(host);
    };

    refreshData();
    locate();

    const observer = new MutationObserver(() => locate());
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    const timer = window.setInterval(() => { refreshData(); locate(); }, 900);
    const onState = () => { refreshData(); setTimeout(locate, 0); };
    window.addEventListener('ark-tracker-state-updated', onState);
    window.addEventListener('storage', onState);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.removeEventListener('ark-tracker-state-updated', onState);
      window.removeEventListener('storage', onState);
      clearLeaderboardMount();
    };
  }, []);

  const courseStudents = useMemo(() => {
    return (state.students || []).filter(student => {
      if (student.archived) return false;
      return courseId === 'all' || courseOf(state, student) === courseId;
    });
  }, [state, courseId]);

  const groups = useMemo(() => {
    const groupSet = new Set(courseStudents.map(student => student.group).filter(Boolean));
    const ordered = [];
    (state.groups || []).forEach(name => { if (groupSet.has(name) && !ordered.includes(name)) ordered.push(name); });
    courseStudents.forEach(student => { if (student.group && !ordered.includes(student.group)) ordered.push(student.group); });
    return ordered;
  }, [courseStudents, state.groups]);

  useEffect(() => {
    if (group !== 'all' && !groups.includes(group)) setGroup('all');
  }, [groups, group]);

  const visibleStudents = useMemo(() => {
    const scoped = group === 'all' ? courseStudents : courseStudents.filter(student => student.group === group);
    return [...scoped].sort((a, b) => metricValue(b, mode) - metricValue(a, mode) || Number(b.xp || 0) - Number(a.xp || 0) || String(a.name || '').localeCompare(String(b.name || '')));
  }, [courseStudents, group, mode]);

  const total = visibleStudents.reduce((sum, student) => sum + metricValue(student, mode), 0);
  const average = visibleStudents.length ? Math.round(total / visibleStudents.length) : 0;
  const top = visibleStudents[0];
  const weeklyMax = Math.max(0, ...visibleStudents.map(student => Number(student.pts || 0)));
  const podium = [
    { student: visibleStudents[1], rank: 2 },
    { student: visibleStudents[0], rank: 1 },
    { student: visibleStudents[2], rank: 3 },
  ].filter(item => item.student);
  const selectedLabel = group === 'all' ? 'All groups' : group;

  if (!mount) return null;

  return createPortal(<div className="ark-group-leaderboard page-stack">
    <section className="ark-lb-hero">
      <div className="ark-lb-hero-copy">
        <span className="eyebrow">ARK GROUP COMPETITION</span>
        <h2>{selectedLabel} Leaderboard</h2>
        <p>{mode === 'xp' ? 'Lifetime XP ranking — long-term progress that never resets.' : 'Weekly ranking — current points for this week, reset automatically every Sunday.'}</p>
      </div>
      <div className="ark-lb-mode-switch" role="tablist" aria-label="Leaderboard mode">
        <button className={mode === 'xp' ? 'active' : ''} onClick={() => setMode('xp')}><TrendingUp size={16}/>XP</button>
        <button className={mode === 'weekly' ? 'active' : ''} onClick={() => setMode('weekly')}><Coins size={16}/>Weekly</button>
      </div>
    </section>

    <section className="panel ark-lb-toolbar">
      <div className="ark-lb-group-tabs">
        <button className={group === 'all' ? 'active' : ''} onClick={() => setGroup('all')}>All Groups <span>{courseStudents.length}</span></button>
        {groups.map(name => {
          const count = courseStudents.filter(student => student.group === name).length;
          return <button key={name} className={group === name ? 'active' : ''} onClick={() => setGroup(name)}>{name} <span>{count}</span></button>;
        })}
      </div>
      <div className="ark-lb-toolbar-note">{mode === 'xp' ? 'XP controls Starter → Diamond levels' : 'Weekly points reset Sunday 00:00 · Asia/Tashkent'}</div>
    </section>

    <section className="ark-lb-stats">
      <StatCard icon={Users} label="Students" value={visibleStudents.length} hint={selectedLabel}/>
      <StatCard icon={TrendingUp} label={mode === 'xp' ? 'Total XP' : 'Weekly total'} value={total.toLocaleString()} hint={metricLabel(mode)}/>
      <StatCard icon={Trophy} label="Average" value={average.toLocaleString()} hint={`${metricLabel(mode)} per student`}/>
      <StatCard icon={Crown} label="Top student" value={top?.name || '—'} hint={top ? `${metricValue(top, mode).toLocaleString()} ${metricLabel(mode)}` : 'No data'}/>
    </section>

    {visibleStudents.length ? <>
      <section className="ark-lb-podium">
        {podium.map(({ student, rank }) => <PodiumCard key={student.id} student={student} rank={rank} mode={mode}/>)}
      </section>

      <section className="panel ark-lb-ranking-panel">
        <div className="ark-lb-ranking-head">
          <div><span className="eyebrow">FULL RANKING</span><h2>{selectedLabel}</h2></div>
          <span>{visibleStudents.length} active students</span>
        </div>
        <div className="ark-lb-ranking-list">
          {visibleStudents.map((student, index) => <RankingRow key={student.id} student={student} rank={index + 1} mode={mode} weeklyMax={weeklyMax}/>)}
        </div>
      </section>
    </> : <section className="panel ark-lb-empty"><Users size={28}/><b>No students in this group</b><span>Add students or choose another group.</span></section>}
  </div>, mount);
}
