'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BookOpen, CalendarDays, Check, ChevronDown, CirclePlus, Coins,
  Download, LayoutDashboard, Minus, Plus, Save, Search, Settings2, ShieldCheck,
  Sparkles, Trash2, Trophy, Upload, UserCheck, Users, X, Medal, TrendingUp, Crown
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
  { key: 'speaking', label: 'Task 1' },
  { key: 'writing', label: 'Task 2' },
  { key: 'reading', label: 'Task 3' },
  { key: 'listening', label: 'Task 4' },
];

const DEFAULT_GROUPS = ['IELTS', 'CEFR', '404'];
const STATE_KEY = 'ark-tracker-v1';
const LAST_GROUP_KEY = 'ark-tracker-last-group';

const seed = {
  students: [],
  records: {},
  taskLabels: {},
  lessonTopics: {},
  groups: DEFAULT_GROUPS,
  deletedGroups: [],
  liveLessons: { IELTS: 0, CEFR: 0, '404': 0 },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? { ...seed, ...JSON.parse(raw) } : seed;
  } catch {
    return seed;
  }
}

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

function localISODate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function planDateForToday() {
  const today = localISODate();
  if (DAY_PLAN.some(d => d.date === today)) return today;
  const past = DAY_PLAN.filter(d => d.date <= today).at(-1);
  return past?.date || DAY_PLAN[0].date;
}

function taskState(value) {
  if (value === true || value === 'done') return 'done';
  if (value === 'partial') return 'partial';
  if (value === 'notdone') return 'notdone';
  return 'unset';
}

function taskScore(value) {
  const status = taskState(value);
  if (status === 'done') return 1;
  if (status === 'partial') return 0.5;
  return 0;
}

function visibleGroups(state) {
  const deleted = new Set(Array.isArray(state.deletedGroups) ? state.deletedGroups : []);
  const saved = Array.isArray(state.groups) ? state.groups : DEFAULT_GROUPS;
  const fromStudents = (state.students || []).map(s => s.group).filter(Boolean);
  return [...new Set([...DEFAULT_GROUPS, ...saved, ...fromStudents])].filter(g => !deleted.has(g));
}

function assignedKeysFrom(state, group, date) {
  return MODULES
    .filter(m => String(state.taskLabels?.[group]?.[date]?.[m.key] || '').trim())
    .map(m => m.key);
}

export default function Home() {
  const [tab, setTab] = useState('Overall');
  const [state, setState] = useState(seed);
  const [ready, setReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(DAY_PLAN[0].date);
  const [controlGroup, setControlGroup] = useState('IELTS');
  const restoreRef = useRef(null);

  const groups = useMemo(() => visibleGroups(state), [state.groups, state.students, state.deletedGroups]);

  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    const available = visibleGroups(loaded);
    const savedGroup = localStorage.getItem(LAST_GROUP_KEY);
    setControlGroup(available.includes(savedGroup) ? savedGroup : (available[0] || ''));
    setSelectedDate(planDateForToday());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state, ready]);

  useEffect(() => {
    if (ready && controlGroup) localStorage.setItem(LAST_GROUP_KEY, controlGroup);
  }, [controlGroup, ready]);

  useEffect(() => {
    if (groups.includes(tab)) setControlGroup(tab);
  }, [tab, groups]);

  useEffect(() => {
    if (groups.length && !groups.includes(controlGroup)) setControlGroup(groups[0]);
  }, [groups, controlGroup]);

  const scoped = useMemo(() => {
    const list = (state.students || []).filter(s => s.group === controlGroup);
    return list.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  }, [state.students, controlGroup, query]);

  const stats = useMemo(() => {
    const list = groups.includes(tab)
      ? (state.students || []).filter(s => s.group === tab)
      : (state.students || []).filter(s => groups.includes(s.group));
    let present = 0, absent = 0, pts = 0, submittedScore = 0, totalTasks = 0;

    list.forEach(s => {
      pts += s.pts || 0;
      DAY_PLAN.forEach(d => {
        if (d.rest) return;
        const r = state.records?.[s.id]?.[d.date];
        if (r?.attendance === 'present') present++;
        if (r?.attendance === 'absent') absent++;
        assignedKeysFrom(state, s.group, d.date).forEach(key => {
          totalTasks++;
          submittedScore += taskScore(r?.modules?.[key]);
        });
      });
    });

    return { students: list.length, present, absent, pts, submitted: pct(submittedScore, totalTasks) };
  }, [state, tab, groups]);

  const dailySummary = useMemo(() => {
    const list = (state.students || []).filter(s => s.group === controlGroup);
    const active = assignedKeysFrom(state, controlGroup, selectedDate);
    let done = 0, partial = 0, notDone = 0, present = 0, absent = 0, score = 0;

    list.forEach(s => {
      const rec = state.records?.[s.id]?.[selectedDate] || {};
      if (rec.attendance === 'present') present++;
      if (rec.attendance === 'absent') absent++;
      active.forEach(key => {
        const status = taskState(rec.modules?.[key]);
        if (status === 'done') done++;
        else if (status === 'partial') partial++;
        else if (status === 'notdone') notDone++;
        score += taskScore(rec.modules?.[key]);
      });
    });

    const possible = list.length * active.length;
    return {
      students: list.length,
      done,
      partial,
      notDone,
      progress: pct(score, possible),
      present,
      absent,
      assigned: active.length,
    };
  }, [state, controlGroup, selectedDate]);

  const leaderboard = useMemo(() => {
    const list = groups.includes(tab)
      ? (state.students || []).filter(s => s.group === tab)
      : (state.students || []).filter(s => groups.includes(s.group));
    return [...list].sort((a,b) => (b.pts || 0) - (a.pts || 0)).slice(0, 8);
  }, [state.students, tab, groups]);

  const dailyChart = useMemo(() => DAY_PLAN.map(d => {
    const list = groups.includes(tab)
      ? (state.students || []).filter(s => s.group === tab)
      : (state.students || []).filter(s => groups.includes(s.group));
    if (d.rest) return { ...d, value: null, score: 0, possible: 0 };

    let score = 0, possible = 0;
    list.forEach(s => {
      const active = assignedKeysFrom(state, s.group, d.date);
      possible += active.length;
      active.forEach(key => {
        score += taskScore(state.records?.[s.id]?.[d.date]?.modules?.[key]);
      });
    });

    return { ...d, value: possible ? pct(score, possible) : 0, score, possible };
  }), [state, tab, groups]);

  const progressSummary = useMemo(() => {
    const assignedDays = dailyChart.filter(d => !d.rest && d.possible > 0);
    const finished = assignedDays.filter(d => d.score === d.possible).length;
    const open = assignedDays.filter(d => d.score < d.possible && d.score > 0).length;
    const untouched = assignedDays.filter(d => d.score === 0).length;
    return { finished, open, untouched, assignedDays: assignedDays.length };
  }, [dailyChart]);

  const blackList = useMemo(() => {
    const today = localISODate();
    const list = (state.students || []).filter(s => groups.includes(s.group));

    return list.map(student => {
      let streak = 0;
      let streakDays = [];

      DAY_PLAN.forEach(day => {
        if (day.rest || day.date > today) return;
        const active = assignedKeysFrom(state, student.group, day.date);
        if (!active.length) return;

        const rawValues = active.map(key => state.records?.[student.id]?.[day.date]?.modules?.[key]);
        const statuses = rawValues.map(taskState);

        let result = null;
        if (day.date === today) {
          if (statuses.some(s => s === 'partial' || s === 'notdone')) result = 'bad';
          else if (statuses.every(s => s === 'done')) result = 'good';
          else result = 'pending';
        } else {
          result = statuses.every(s => s === 'done') ? 'good' : 'bad';
        }

        if (result === 'bad') {
          streak += 1;
          streakDays.push({ date: day.date, label: day.label, statuses });
        } else if (result === 'good') {
          streak = 0;
          streakDays = [];
        }
      });

      return streak >= 2 ? { student, streak, days: streakDays.slice(-2) } : null;
    }).filter(Boolean).sort((a,b) => b.streak - a.streak || a.student.name.localeCompare(b.student.name));
  }, [state, groups]);

  const addStudent = (name, group) => {
    const clean = name.trim();
    if (!clean || !group) return;
    setState(p => ({
      ...p,
      students: [...(p.students || []), { id: crypto.randomUUID(), name: clean, group, pts: 0 }]
    }));
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
      deletedGroups: (Array.isArray(p.deletedGroups) ? p.deletedGroups : []).filter(g => g.toLowerCase() !== clean.toLowerCase()),
      liveLessons: { ...(p.liveLessons || {}), [clean]: p.liveLessons?.[clean] || 0 }
    }));
    setTab(clean);
    setControlGroup(clean);
    setShowAddGroup(false);
  };

  const removeStudent = (id) => setState(p => ({
    ...p,
    students: (p.students || []).filter(s => s.id !== id),
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

  const toggleModule = (id, date, key) => setState(p => {
    const current = taskState(p.records?.[id]?.[date]?.modules?.[key]);
    const next = current === 'unset'
      ? 'partial'
      : current === 'partial'
        ? 'done'
        : current === 'done'
          ? 'notdone'
          : 'unset';
    const modules = { ...(p.records?.[id]?.[date]?.modules || {}) };
    if (next === 'unset') delete modules[key];
    else modules[key] = next;

    return {
      ...p,
      records: {
        ...(p.records || {}),
        [id]: {
          ...(p.records?.[id] || {}),
          [date]: {
            ...(p.records?.[id]?.[date] || {}),
            modules
          }
        }
      }
    };
  });

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

  const setLessonTopic = (group, date, value) => setState(p => ({
    ...p,
    lessonTopics: {
      ...(p.lessonTopics || {}),
      [group]: {
        ...(p.lessonTopics?.[group] || {}),
        [date]: value
      }
    }
  }));

  const addPts = (id, delta) => setState(p => ({
    ...p,
    students: (p.students || []).map(s =>
      s.id === id ? { ...s, pts: Math.max(0, (s.pts || 0) + delta) } : s
    )
  }));

  const goToday = () => setSelectedDate(planDateForToday());

  const backupData = () => {
    const payload = {
      app: 'ARK Tracker',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ark-tracker-backup-${localISODate()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const restoreData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      if (!data || !Array.isArray(data.students) || typeof data.records !== 'object') {
        throw new Error('Invalid backup');
      }
      if (!window.confirm('Restore this backup? Current tracker data will be replaced.')) return;
      const next = { ...seed, ...data };
      setState(next);
      const nextGroups = visibleGroups(next);
      setControlGroup(nextGroups[0] || '');
      setTab('Overall');
      setSelectedDate(planDateForToday());
    } catch {
      window.alert('This is not a valid ARK Tracker backup file.');
    }
  };

  const dateInfo = DAY_PLAN.find(d => d.date === selectedDate);
  const currentTopic = state.lessonTopics?.[controlGroup]?.[selectedDate] || '';
  const title = tab === 'Leaderboard' ? 'Leaderboard' : tab === 'Black list' ? 'Black list' : `${tab} Dashboard`;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div><b>ARK</b><span>TRACKER</span></div>
        </div>

        <nav>
          <button className={tab === 'Overall' ? 'active' : ''} onClick={() => setTab('Overall')}>
            <LayoutDashboard size={18}/> Overall
          </button>

          {groups.map(group => {
            const Icon = group === 'IELTS' ? ShieldCheck : group === 'CEFR' ? BookOpen : Users;
            return (
              <button key={group} className={tab === group ? 'active' : ''} onClick={() => setTab(group)}>
                <Icon size={18}/> {group}
              </button>
            );
          })}

          <button className={tab === 'Black list' ? 'active' : ''} onClick={() => setTab('Black list')}>
            <AlertTriangle size={18}/> Black list <span className="nav-count">{blackList.length}</span>
          </button>

          <button className={tab === 'Leaderboard' ? 'active' : ''} onClick={() => setTab('Leaderboard')}>
            <Trophy size={18}/> Leaderboard
          </button>
        </nav>

        <div className="sidebar-note">
          <Sparkles size={17}/>
          <div><b>Teacher workspace</b><span>Topic · homework · attendance</span></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">ARK EDUCATION</span>
            <h1>{title}</h1>
            <p>Daily lesson topic, homework control and student progress.</p>
          </div>
          <div className="top-actions">
            <button className="view-all" onClick={backupData}><Download size={16}/> Backup</button>
            <button className="view-all" onClick={() => restoreRef.current?.click()}><Upload size={16}/> Restore</button>
            <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={restoreData}/>
            <button className="view-all add-group-btn" onClick={() => setShowAddGroup(true)}>
              <Plus size={17}/> Add group
            </button>
            <button className="primary" onClick={() => setShowAdd(true)} disabled={!groups.length}>
              <CirclePlus size={18}/> Add student
            </button>
          </div>
        </header>

        {tab === 'Leaderboard' ? (
          <LeaderboardPage students={(state.students || []).filter(s => groups.includes(s.group))}/>
        ) : tab === 'Black list' ? (
          <BlackListPage items={blackList}/>
        ) : groups.length === 0 ? (
          <section className="panel"><Empty text="No groups are available. Add a group to continue."/></section>
        ) : (
          <>
            <section className="daily-toolbar panel">
              <div className="toolbar-title">
                <span className="eyebrow">DAILY CONTROL</span>
                <h2>{controlGroup} · {dateInfo?.label}</h2>
                <p>Choose the group and day, write the lesson topic and homework, then mark students.</p>
              </div>
              <div className="controls">
                <label className="select-wrap group-filter">
                  <Users size={16}/>
                  <select value={controlGroup} onChange={e => setControlGroup(e.target.value)}>
                    {groups.map(group => <option key={group} value={group}>{group} group</option>)}
                  </select>
                  <ChevronDown size={14}/>
                </label>
                <label className="select-wrap">
                  <CalendarDays size={16}/>
                  <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
                    {DAY_PLAN.map(d =>
                      <option key={d.date} value={d.date}>{d.label} · {d.day}{d.rest ? ' · No lesson' : ''}</option>
                    )}
                  </select>
                  <ChevronDown size={14}/>
                </label>
                <button className="view-all today-btn" onClick={goToday}><CalendarDays size={15}/> Today</button>
              </div>
            </section>

            <section className="kpis daily-kpis">
              <Kpi tone="neutral" icon={Users} label="Students" value={dailySummary.students} hint={`${controlGroup} group`} />
              <Kpi tone="green" icon={Check} label="Homework done" value={dailySummary.done} hint={`${dailySummary.assigned} task${dailySummary.assigned === 1 ? '' : 's'} assigned`} />
              <Kpi tone="yellow" icon={Minus} label="Partial" value={dailySummary.partial} hint="counts as 50%" />
              <Kpi tone="red" icon={Minus} label="Homework not done" value={dailySummary.notDone} hint="not completed" />
              <Kpi tone="orange" icon={UserCheck} label="Absent" value={dailySummary.absent} hint={`${dailySummary.present} present`} />
              <Kpi tone="yellow" icon={TrendingUp} label="Group progress" value={`${dailySummary.progress}%`} hint={dailySummary.assigned ? 'today' : 'write a task first'} />
            </section>

            {dateInfo?.rest ? (
              <section className="panel rest-day">
                <CalendarDays size={28}/>
                <div>
                  <b>{dateInfo.label} — Sunday</b>
                  <span>No lesson. Choose another date to write a topic or homework.</span>
                </div>
              </section>
            ) : (
              <>
                <section className="lesson-setup panel">
                  <div className="setup-head">
                    <div>
                      <span className="eyebrow">LESSON SETUP</span>
                      <h2>Topic & homework</h2>
                    </div>
                    <div className="date-chip"><CalendarDays size={15}/>{dateInfo?.label} · {dateInfo?.day}</div>
                  </div>

                  <div className="topic-field">
                    <label>Lesson topic</label>
                    <input
                      value={currentTopic}
                      onChange={e => setLessonTopic(controlGroup, selectedDate, e.target.value)}
                      placeholder="e.g. Reading — Matching Headings / Unit 12.3"
                    />
                  </div>

                  <div className="homework-fields">
                    {MODULES.map((m, i) => (
                      <div className="homework-field" key={m.key}>
                        <label>Homework {i + 1}</label>
                        <input
                          value={state.taskLabels?.[controlGroup]?.[selectedDate]?.[m.key] || ''}
                          onChange={e => setTaskLabel(controlGroup, selectedDate, m.key, e.target.value)}
                          placeholder="Vazifani yozing"
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel tracker-panel">
                  <div className="panel-head tracker-head">
                    <div>
                      <span className="eyebrow">STUDENT CHECK</span>
                      <h2>Who did the homework?</h2>
                      <p className="section-subtitle">
                        White = not marked · yellow = partial · green = done · red = not done. Click to cycle: Partial → Done → Not done → White.
                      </p>
                    </div>
                    <label className="search">
                      <Search size={16}/>
                      <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={`Search ${controlGroup} student`}
                      />
                    </label>
                  </div>

                  {scoped.length === 0 ? (
                    <Empty text="No students in this group yet. Add a student and choose this group."/>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th className="student-col">Student</th>
                            <th>Attendance</th>
                            {MODULES.map((m, i) => {
                              const label = state.taskLabels?.[controlGroup]?.[selectedDate]?.[m.key] || '';
                              return (
                                <th key={m.key} className={label.trim() ? 'assigned-task' : 'empty-task'}>
                                  <span className="task-number">HW {i + 1}</span>
                                  <span className="task-title">{label || 'No task'}</span>
                                </th>
                              );
                            })}
                            <th>PTS</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {scoped.map((s, index) => {
                            const rec = state.records?.[s.id]?.[selectedDate] || {};
                            return (
                              <tr key={s.id}>
                                <td>
                                  <div className="student-cell">
                                    <span className="row-number">{index + 1}</span>
                                    <div className="avatar">{s.name.slice(0,1).toUpperCase()}</div>
                                    <div className="student-name">
                                      <b>{s.name}</b>
                                      <small>{s.group}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="attendance-buttons">
                                    <button
                                      className={rec.attendance === 'present' ? 'present on' : 'present'}
                                      onClick={() => setAttendance(s.id, selectedDate, 'present')}
                                    >
                                      <Check size={14}/> Present
                                    </button>
                                    <button
                                      className={rec.attendance === 'absent' ? 'absent on' : 'absent'}
                                      onClick={() => setAttendance(s.id, selectedDate, 'absent')}
                                    >
                                      <X size={14}/> Absent
                                    </button>
                                  </div>
                                </td>

                                {MODULES.map(m => {
                                  const label = String(state.taskLabels?.[controlGroup]?.[selectedDate]?.[m.key] || '').trim();
                                  const status = taskState(rec.modules?.[m.key]);
                                  const statusLabel = status === 'partial' ? 'Partial' : status === 'done' ? 'Done' : status === 'notdone' ? 'Not done' : 'Not marked';
                                  return (
                                    <td key={m.key} className="homework-cell">
                                      <button
                                        disabled={!label}
                                        className={`task-check ${status} ${!label ? 'disabled' : ''}`}
                                        onClick={() => label && toggleModule(s.id, selectedDate, m.key)}
                                        aria-label={`${label || 'No task'} ${status}`}
                                        title={label ? `${label} — ${statusLabel}` : 'Write the homework first'}
                                      >
                                        {status === 'done' ? <Check size={17}/> : status === 'partial' ? <span className="partial-mark">◐</span> : <Minus size={17}/>} 
                                      </button>
                                    </td>
                                  );
                                })}

                                <td>
                                  <div className="pts-control">
                                    <button onClick={() => addPts(s.id, -1)}><Minus size={14}/></button>
                                    <strong>{s.pts || 0}</strong>
                                    <button onClick={() => addPts(s.id, 1)}><Plus size={14}/></button>
                                  </div>
                                </td>
                                <td>
                                  <button className="icon-danger" onClick={() => removeStudent(s.id)} title="Delete">
                                    <Trash2 size={16}/>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            <section className="schedule-grid">
              <div className="panel schedule-panel">
                <div className="panel-head">
                  <div><span className="eyebrow">20-DAY PLAN</span><h2>Lesson calendar</h2></div>
                </div>
                <div className="calendar-grid">
                  {DAY_PLAN.map(d => {
                    const topic = state.lessonTopics?.[controlGroup]?.[d.date] || '';
                    return (
                      <button
                        key={d.date}
                        onClick={() => setSelectedDate(d.date)}
                        className={`${d.rest ? 'rest' : ''} ${selectedDate === d.date ? 'selected' : ''}`}
                      >
                        <b>{d.label}</b>
                        <span>{d.rest ? 'No lesson' : (topic || 'Add topic')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="panel live-panel">
                <div className="panel-head">
                  <div><span className="eyebrow">LIVE LESSONS</span><h2>Weekly counters</h2></div>
                  <Settings2 size={20}/>
                </div>
                {groups.map(group =>
                  <LiveCounter
                    key={group}
                    label={group}
                    value={state.liveLessons?.[group] || 0}
                    setValue={v => setState(p => ({
                      ...p,
                      liveLessons: { ...(p.liveLessons || {}), [group]: v }
                    }))}
                  />
                )}
                <p className="muted">Existing counter data is preserved.</p>
              </div>
            </section>

            <section className="overview-grid premium-grid">
              <div className="panel chart-panel premium-panel">
                <div className="panel-head results-head">
                  <div>
                    <span className="eyebrow">20-DAY RESULTS</span>
                    <h2>Homework submitted</h2>
                    <div className="results-value">{stats.submitted}%</div>
                    <p className="results-copy">
                      {progressSummary.finished} finished · {progressSummary.open} open · {progressSummary.untouched} not started
                    </p>
                  </div>
                  <div className="progress-badge">
                    <TrendingUp size={16}/><b>{stats.submitted}%</b><span>partial = 50%</span>
                  </div>
                </div>
                <ProgressChart data={dailyChart}/>
                <div className="chart-legend">
                  <span><i className="legend-dot green"></i>Submitted progress</span>
                  <span><i className="legend-dot rest"></i>Sunday</span>
                </div>
              </div>

              <div className="panel leaderboard premium-panel">
                <div className="panel-head">
                  <div><span className="eyebrow">TOP STUDENTS</span><h2>Leaderboard</h2></div>
                  <button className="view-all" onClick={() => setTab('Leaderboard')}>View all <ChevronDown size={14}/></button>
                </div>
                {leaderboard.length === 0 ? (
                  <Empty text="Add students to start the leaderboard."/>
                ) : (
                  <>
                    <MiniPodium leaders={leaderboard.slice(0,3)}/>
                    <div className="leader-list">
                      {leaderboard.slice(3,8).map((s,i) => <LeaderRow key={s.id} student={s} rank={i + 4}/>) }
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </section>

      {showAdd && <AddModal groups={groups} onClose={() => setShowAdd(false)} onAdd={addStudent}/>} 
      {showAddGroup && <AddGroupModal onClose={() => setShowAddGroup(false)} onAdd={addGroup}/>} 
    </main>
  );
}

function Kpi({icon: Icon, label, value, hint, tone = 'neutral'}) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-icon"><Icon size={20}/></div>
      <div className="kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}

function ProgressChart({data}) {
  const w = 760, h = 220, pad = 24;
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const coords = data.map((d,i) => ({
    x: pad + i * step,
    y: d.value == null ? null : h - pad - (d.value / 100) * (h - pad * 2),
    ...d
  }));
  const segments = [];
  let seg = [];
  coords.forEach(p => {
    if (p.y == null) {
      if (seg.length) { segments.push(seg); seg = []; }
    } else seg.push(p);
  });
  if (seg.length) segments.push(seg);

  const pathFor = arr => arr.map((p,i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaFor = arr => arr.length
    ? `${pathFor(arr)} L${arr.at(-1).x.toFixed(1)},${h-pad} L${arr[0].x.toFixed(1)},${h-pad} Z`
    : '';

  return (
    <div className="line-chart twenty-day-chart">
      <div className="chart-y"><span>100%</span><span>50%</span><span>0%</span></div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34b46f" stopOpacity=".22"/>
            <stop offset="100%" stopColor="#34b46f" stopOpacity=".01"/>
          </linearGradient>
        </defs>
        <line x1={pad} x2={w-pad} y1={pad} y2={pad} className="grid-line"/>
        <line x1={pad} x2={w-pad} y1={h/2} y2={h/2} className="grid-line"/>
        <line x1={pad} x2={w-pad} y1={h-pad} y2={h-pad} className="grid-line"/>
        {coords.filter(p => p.rest).map((p,i) =>
          <line key={`rest-${i}`} x1={p.x} x2={p.x} y1={pad} y2={h-pad} className="rest-line"/>
        )}
        {segments.map((arr,i) =>
          <g key={i}>
            <path d={areaFor(arr)} fill="url(#areaFill)"/>
            <path d={pathFor(arr)} className="progress-line"/>
          </g>
        )}
        {coords.filter(p => p.y != null).map((p,i) =>
          <circle key={i} cx={p.x} cy={p.y} r="3.5" className="progress-dot"/>
        )}
      </svg>
      <div className="chart-x twenty-labels">
        {data.map(d => <span key={d.date} className={d.rest ? 'rest-label' : ''}>{d.label.replace(' Sep','')}</span>)}
      </div>
    </div>
  );
}

function BlackListPage({items}) {
  return (
    <section className="blacklist-page">
      <div className="blacklist-hero">
        <div>
          <span className="eyebrow">AUTOMATIC WATCH LIST</span>
          <h2>Black list</h2>
          <p>Students appear here after 2 consecutive lesson days with partial or incomplete homework. A fully completed next lesson clears the streak automatically.</p>
        </div>
        <div className="blacklist-total"><AlertTriangle size={22}/><strong>{items.length}</strong><span>students</span></div>
      </div>

      <div className="panel blacklist-panel">
        {items.length === 0 ? (
          <div className="blacklist-clear"><Check size={30}/><b>No students on the black list</b><span>Everyone is currently clear.</span></div>
        ) : (
          <div className="blacklist-list">
            {items.map(({student, streak, days}, index) => (
              <div className="blacklist-row" key={student.id}>
                <span className="blacklist-rank">{index + 1}</span>
                <div className="avatar">{student.name.slice(0,1).toUpperCase()}</div>
                <div className="blacklist-student">
                  <b>{student.name}</b>
                  <span>{student.group}</span>
                </div>
                <div className="blacklist-days">
                  {days.map(day => <span key={day.date}>{day.label}</span>)}
                </div>
                <div className="blacklist-streak"><b>{streak} days</b><span>incomplete streak</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniPodium({leaders}) {
  const order = [leaders[1], leaders[0], leaders[2]].filter(Boolean);
  return (
    <div className="mini-podium">
      {order.map((s,idx) => {
        const rank = idx === 0 && leaders[1] ? 2 : idx === 1 ? 1 : 3;
        return (
          <div className={`podium-card rank-${rank}`} key={s.id}>
            <div className="podium-crown">{rank === 1 ? <Crown size={18}/> : <Medal size={17}/>}</div>
            <div className="podium-avatar">{s.name[0]?.toUpperCase()}</div>
            <b>{s.name}</b><small>{s.group}</small>
            <strong><Coins size={14}/>{s.pts || 0}</strong>
            <span className="place">#{rank}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeaderRow({student: s, rank}) {
  return (
    <div className="leader-row">
      <span className={`rank r${rank}`}>{rank}</span>
      <div className="avatar">{s.name.slice(0,1).toUpperCase()}</div>
      <div className="grow"><b>{s.name}</b><small>{s.group}</small></div>
      <strong>{s.pts || 0} <Coins size={14}/></strong>
    </div>
  );
}

function LeaderboardPage({students}) {
  const list = [...students].sort((a,b) => (b.pts || 0) - (a.pts || 0));
  return (
    <section className="leaderboard-page">
      <div className="leader-hero">
        <div>
          <span className="eyebrow">ARK RANKING</span>
          <h2>Student Leaderboard</h2>
          <p>Points earned from attendance, lesson work and daily performance.</p>
        </div>
        <div className="hero-trophy"><Trophy size={34}/></div>
      </div>

      {list.length === 0 ? (
        <div className="panel"><Empty text="Add students and start giving PTS to build the ranking."/></div>
      ) : (
        <>
          <div className="grand-podium"><MiniPodium leaders={list.slice(0,3)}/></div>
          <div className="panel ranking-table">
            <div className="ranking-head"><span>Rank</span><span>Participant</span><span>Group</span><span>PTS</span></div>
            {list.map((s,i) =>
              <div className={`ranking-row ${i === 0 ? 'winner' : ''}`} key={s.id}>
                <span className="ranking-number">{i + 1}</span>
                <div className="participant"><div className="avatar">{s.name[0]?.toUpperCase()}</div><b>{s.name}</b></div>
                <span className="group-tag">{s.group}</span>
                <strong><Coins size={15}/>{s.pts || 0}</strong>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Empty({text}) {
  return <div className="empty"><Users size={30}/><b>Nothing here yet</b><span>{text}</span></div>;
}

function LiveCounter({label, value, setValue}) {
  return (
    <div className="live-counter">
      <div><b>{label}</b><span>live lessons / week</span></div>
      <div className="pts-control">
        <button onClick={() => setValue(Math.max(0, value - 1))}><Minus size={14}/></button>
        <strong>{value}</strong>
        <button onClick={() => setValue(value + 1)}><Plus size={14}/></button>
      </div>
    </div>
  );
}

function AddModal({groups, onClose, onAdd}) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState(groups[0] || '');
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">NEW STUDENT</span><h2>Add to tracker</h2></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <label>Student name
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Muhammadali Karimov"
            onKeyDown={e => { if (e.key === 'Enter') onAdd(name, group); }}
          />
        </label>
        <label>Group
          <select value={group} onChange={e => setGroup(e.target.value)}>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <button className="primary full" onClick={() => onAdd(name, group)}><Save size={17}/> Save student</button>
      </div>
    </div>
  );
}

function AddGroupModal({onClose, onAdd}) {
  const [name, setName] = useState('');
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">NEW GROUP</span><h2>Add group</h2></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <label>Group name
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. 909"
            onKeyDown={e => { if (e.key === 'Enter') onAdd(name); }}
          />
        </label>
        <button className="primary full" onClick={() => onAdd(name)}><Save size={17}/> Save group</button>
      </div>
    </div>
  );
}
