'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Coins,
  Crown,
  LayoutDashboard,
  Medal,
  Plus,
  Search,
  Trophy,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

const STATE_KEY = 'ark-tracker-v1';
const LAST_GROUP_KEY = 'ark-tracker-last-group';
const LAST_PAGE_KEY = 'ark-tracker-simple-page';

const seed = {
  students: [],
  records: {},
  groups: [],
  deletedGroups: [],
  groupMeta: {},
  coinTransactions: [],
  xpTransactions: [],
  schemaVersion: 4,
};

const NAV = [
  { key: 'overview', label: 'Bosh sahifa', icon: LayoutDashboard },
  { key: 'daily', label: 'Kunlik baho', icon: CalendarDays },
  { key: 'groups', label: 'Guruhlar', icon: Users },
  { key: 'leaderboard', label: 'Reyting', icon: Trophy },
];

const LEVELS = [
  { level: 1, name: 'Starter', min: 0, max: 99 },
  { level: 2, name: 'Bronze', min: 100, max: 199 },
  { level: 3, name: 'Silver', min: 200, max: 299 },
  { level: 4, name: 'Gold', min: 300, max: 399 },
  { level: 5, name: 'Platinum', min: 400, max: 499 },
  { level: 6, name: 'Diamond', min: 500, max: 599 },
  { level: 7, name: 'Master', min: 600, max: 699 },
  { level: 8, name: 'Elite', min: 700, max: 799 },
  { level: 9, name: 'Champion', min: 800, max: 899 },
  { level: 10, name: 'Legend', min: 900, max: Infinity },
];

function localISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeState(raw) {
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const base = { ...seed, ...incoming };
  const deleted = new Set(Array.isArray(base.deletedGroups) ? base.deletedGroups : []);
  const savedGroups = Array.isArray(base.groups) ? base.groups : [];
  const studentGroups = (Array.isArray(base.students) ? base.students : []).map(student => student?.group).filter(Boolean);
  const groups = [...new Set([...savedGroups, ...studentGroups])].filter(group => !deleted.has(group));

  const students = (Array.isArray(base.students) ? base.students : []).map(student => ({
    ...student,
    id: student.id || crypto.randomUUID(),
    name: student.name || 'O‘quvchi',
    group: student.group || groups[0] || '',
    pts: Number(student.pts || 0),
    xp: Number.isFinite(Number(student.xp)) ? Number(student.xp) : Number(student.pts || 0),
    archived: Boolean(student.archived),
  }));

  return {
    ...base,
    schemaVersion: 4,
    groups,
    students,
    records: base.records && typeof base.records === 'object' ? base.records : {},
    deletedGroups: Array.isArray(base.deletedGroups) ? base.deletedGroups : [],
    groupMeta: base.groupMeta && typeof base.groupMeta === 'object' ? base.groupMeta : {},
    coinTransactions: Array.isArray(base.coinTransactions) ? base.coinTransactions : [],
    xpTransactions: Array.isArray(base.xpTransactions) ? base.xpTransactions : [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : seed);
  } catch {
    return normalizeState(seed);
  }
}

function levelFor(xp) {
  const value = Math.max(0, Number(xp || 0));
  return LEVELS.find(item => value >= item.min && value <= item.max) || LEVELS[LEVELS.length - 1];
}

function levelProgress(xp) {
  const value = Math.max(0, Number(xp || 0));
  const level = levelFor(value);
  if (level.level === 10) return 100;
  return Math.max(0, Math.min(100, value - level.min));
}

function visibleGroups(state) {
  const deleted = new Set(Array.isArray(state.deletedGroups) ? state.deletedGroups : []);
  const saved = Array.isArray(state.groups) ? state.groups : [];
  const fromStudents = (state.students || []).map(student => student.group).filter(Boolean);
  return [...new Set([...saved, ...fromStudents])].filter(group => !deleted.has(group));
}

function clampOverall(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(10, Math.round(number)));
}

function dailyXp(record) {
  if (!record || typeof record !== 'object') return 0;
  const attendanceXp = record.attendance === 'present' ? 3 : 0;
  const homeworkXp = record.homework === 'done' ? 5 : 0;
  const overall = clampOverall(record.overall);
  return attendanceXp + homeworkXp + (overall === null ? 0 : overall * 2);
}

function average(values) {
  const clean = values.filter(value => Number.isFinite(Number(value))).map(Number);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function fmtOverall(value) {
  return Number.isFinite(value) && value > 0 ? value.toFixed(1) : '—';
}

export default function ArkTrackerV2() {
  const [state, setState] = useState(seed);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('overview');
  const [selectedDate, setSelectedDate] = useState(localISODate());
  const [selectedGroup, setSelectedGroup] = useState('');
  const [leaderboardGroup, setLeaderboardGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentGroupPreset, setStudentGroupPreset] = useState('');

  useEffect(() => {
    const loaded = loadState();
    const groups = visibleGroups(loaded);
    const savedGroup = localStorage.getItem(LAST_GROUP_KEY);
    const savedPage = localStorage.getItem(LAST_PAGE_KEY);
    setState(loaded);
    setSelectedGroup(groups.includes(savedGroup) ? savedGroup : (groups[0] || ''));
    setPage(NAV.some(item => item.key === savedPage) ? savedPage : 'overview');
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state, ready]);

  useEffect(() => {
    if (ready && selectedGroup) localStorage.setItem(LAST_GROUP_KEY, selectedGroup);
  }, [selectedGroup, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(LAST_PAGE_KEY, page);
  }, [page, ready]);

  const groups = useMemo(() => visibleGroups(state), [state]);
  const activeStudents = useMemo(() => (state.students || []).filter(student => !student.archived), [state.students]);

  useEffect(() => {
    if (groups.length && !groups.includes(selectedGroup)) setSelectedGroup(groups[0]);
    if (!groups.length) setSelectedGroup('');
    if (leaderboardGroup !== 'all' && !groups.includes(leaderboardGroup)) setLeaderboardGroup('all');
  }, [groups, selectedGroup, leaderboardGroup]);

  const selectedGroupStudents = useMemo(
    () => activeStudents
      .filter(student => !selectedGroup || student.group === selectedGroup)
      .filter(student => student.name.toLowerCase().includes(query.toLowerCase())),
    [activeStudents, selectedGroup, query],
  );

  const todayRecords = useMemo(
    () => activeStudents.map(student => state.records?.[student.id]?.[selectedDate] || {}),
    [activeStudents, state.records, selectedDate],
  );

  const stats = useMemo(() => {
    const present = todayRecords.filter(record => record.attendance === 'present').length;
    const absent = todayRecords.filter(record => record.attendance === 'absent').length;
    const homeworkDone = todayRecords.filter(record => record.homework === 'done').length;
    const homeworkNotDone = todayRecords.filter(record => record.homework === 'notdone').length;
    const overallAverage = average(todayRecords.map(record => clampOverall(record.overall)).filter(value => value !== null));

    return {
      students: activeStudents.length,
      groups: groups.length,
      attendance: present + absent ? Math.round((present / (present + absent)) * 100) : 0,
      homework: homeworkDone + homeworkNotDone ? Math.round((homeworkDone / (homeworkDone + homeworkNotDone)) * 100) : 0,
      overall: overallAverage,
      coins: activeStudents.reduce((sum, student) => sum + Number(student.pts || 0), 0),
      xp: activeStudents.reduce((sum, student) => sum + Number(student.xp || 0), 0),
    };
  }, [activeStudents, groups.length, todayRecords]);

  const updateDailyRecord = (studentId, patch) => {
    setState(previous => {
      const oldRecord = previous.records?.[studentId]?.[selectedDate] || {};
      const newRecord = { ...oldRecord, ...patch };
      const oldXp = dailyXp(oldRecord);
      const newXp = dailyXp(newRecord);
      const delta = newXp - oldXp;

      return {
        ...previous,
        records: {
          ...(previous.records || {}),
          [studentId]: {
            ...(previous.records?.[studentId] || {}),
            [selectedDate]: newRecord,
          },
        },
        students: (previous.students || []).map(student =>
          student.id === studentId
            ? { ...student, xp: Math.max(0, Number(student.xp || 0) + delta) }
            : student,
        ),
        xpTransactions: delta === 0
          ? (previous.xpTransactions || [])
          : [{
              id: crypto.randomUUID(),
              studentId,
              amount: delta,
              reason: `Kunlik baho · ${selectedDate}`,
              createdAt: new Date().toISOString(),
            }, ...(previous.xpTransactions || [])].slice(0, 1000),
      };
    });
  };

  const awardReward = (studentId, amount, type = 'coin') => {
    const delta = Math.max(0, Math.round(Number(amount || 0)));
    if (!delta) return false;

    setState(previous => {
      const student = (previous.students || []).find(item => item.id === studentId);
      if (!student) return previous;

      const now = new Date().toISOString();

      if (type === 'xp') {
        return {
          ...previous,
          students: (previous.students || []).map(item =>
            item.id === studentId ? { ...item, xp: Math.max(0, Number(item.xp || 0) + delta) } : item,
          ),
          xpTransactions: [{
            id: crypto.randomUUID(),
            studentId,
            amount: delta,
            reason: 'Teacher manual XP',
            createdAt: now,
          }, ...(previous.xpTransactions || [])].slice(0, 1000),
        };
      }

      return {
        ...previous,
        students: (previous.students || []).map(item =>
          item.id === studentId ? { ...item, pts: Math.max(0, Number(item.pts || 0) + delta) } : item,
        ),
        coinTransactions: [{
          id: crypto.randomUUID(),
          studentId,
          amount: delta,
          reason: 'Teacher manual coin',
          createdAt: now,
        }, ...(previous.coinTransactions || [])].slice(0, 1000),
      };
    });

    return true;
  };

  const addGroup = name => {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) return;
    const existing = groups.find(group => group.toLowerCase() === clean.toLowerCase());
    if (existing) {
      setSelectedGroup(existing);
      setShowAddGroup(false);
      return;
    }

    setState(previous => ({
      ...previous,
      groups: [...new Set([...(previous.groups || []), clean])],
      deletedGroups: (previous.deletedGroups || []).filter(group => group.toLowerCase() !== clean.toLowerCase()),
      groupMeta: {
        ...(previous.groupMeta || {}),
        [clean]: { ...(previous.groupMeta?.[clean] || {}), courseId: previous.groupMeta?.[clean]?.courseId || 'english' },
      },
    }));
    setSelectedGroup(clean);
    setShowAddGroup(false);
  };

  const addStudent = ({ name, group }) => {
    const cleanName = String(name || '').trim();
    if (!cleanName || !group) return;
    setState(previous => ({
      ...previous,
      students: [...(previous.students || []), {
        id: crypto.randomUUID(),
        name: cleanName,
        group,
        courseId: previous.groupMeta?.[group]?.courseId || 'english',
        pts: 0,
        xp: 0,
        archived: false,
      }],
    }));
    setSelectedGroup(group);
    setShowAddStudent(false);
  };

  const openAddStudent = group => {
    setStudentGroupPreset(group || selectedGroup || groups[0] || '');
    setShowAddStudent(true);
  };

  const leaderboardStudents = useMemo(() => {
    return activeStudents
      .filter(student => leaderboardGroup === 'all' || student.group === leaderboardGroup)
      .slice()
      .sort((a, b) =>
        Number(b.xp || 0) - Number(a.xp || 0) ||
        Number(b.pts || 0) - Number(a.pts || 0) ||
        a.name.localeCompare(b.name),
      );
  }, [activeStudents, leaderboardGroup]);

  if (!ready) {
    return <main className="st-loading"><div className="st-loader"/><strong>ARK Tracker</strong><span>Yuklanmoqda…</span></main>;
  }

  return (
    <main className="st-shell">
      <aside className="st-sidebar">
        <div className="st-brand">
          <span className="st-brand-mark">A</span>
          <div><strong>ARK</strong><small>TRACKER</small></div>
        </div>

        <nav className="st-nav">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" className={page === item.key ? 'active' : ''} onClick={() => setPage(item.key)}>
                <Icon size={19}/><span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="st-sidebar-note">
          <Zap size={18}/>
          <div><strong>10 Level</strong><small>Har 100 XP’da yangi bosqich</small></div>
        </div>
      </aside>

      <section className="st-content">
        <header className="st-topbar">
          <div>
            <span>ARK EDUCATION CENTRE</span>
            <h1>{NAV.find(item => item.key === page)?.label || 'ARK Tracker'}</h1>
          </div>
          <div className="st-top-actions">
            <button type="button" className="st-secondary-btn" onClick={() => setShowAddGroup(true)}><Plus size={16}/> Guruh</button>
            <button type="button" className="st-primary-btn" onClick={() => openAddStudent(selectedGroup)}><UserPlus size={16}/> O‘quvchi</button>
          </div>
        </header>

        <div className="st-page">
          {page === 'overview' && (
            <Overview
              stats={stats}
              groups={groups}
              students={activeStudents}
              state={state}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              setPage={setPage}
            />
          )}

          {page === 'daily' && (
            <DailyControl
              groups={groups}
              selectedGroup={selectedGroup}
              setSelectedGroup={setSelectedGroup}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              students={selectedGroupStudents}
              state={state}
              query={query}
              setQuery={setQuery}
              updateDailyRecord={updateDailyRecord}
              awardReward={awardReward}
            />
          )}

          {page === 'groups' && (
            <GroupsPage
              groups={groups}
              students={activeStudents}
              state={state}
              onAddGroup={() => setShowAddGroup(true)}
              onAddStudent={openAddStudent}
            />
          )}

          {page === 'leaderboard' && (
            <Leaderboard
              groups={groups}
              selectedGroup={leaderboardGroup}
              setSelectedGroup={setLeaderboardGroup}
              students={leaderboardStudents}
            />
          )}
        </div>
      </section>

      <nav className="st-mobile-nav">
        {NAV.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.key} type="button" className={page === item.key ? 'active' : ''} onClick={() => setPage(item.key)}>
              <Icon size={20}/><span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showAddGroup && <AddGroupModal onClose={() => setShowAddGroup(false)} onAdd={addGroup}/>}
      {showAddStudent && <AddStudentModal groups={groups} initialGroup={studentGroupPreset} onClose={() => setShowAddStudent(false)} onAdd={addStudent}/>}
    </main>
  );
}

function Overview({ stats, groups, students, state, selectedDate, setSelectedDate, setPage }) {
  const leaders = [...students].sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0) || Number(b.pts || 0) - Number(a.pts || 0)).slice(0, 5);

  return (
    <div className="st-stack">
      <section className="st-overview-head">
        <div><span>BUGUNGI NAZORAT</span><h2>Hammasi bir joyda</h2><p>Keldi-kelmadi, uyga vazifa, Overall, Coin va XP.</p></div>
        <label className="st-date-field"><CalendarDays size={16}/><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}/></label>
      </section>

      <section className="st-kpi-grid">
        <Stat icon={Users} label="O‘quvchilar" value={stats.students} tone="blue"/>
        <Stat icon={CheckCircle2} label="Davomat" value={`${stats.attendance}%`} tone="green"/>
        <Stat icon={BarChart3} label="Overall" value={fmtOverall(stats.overall)} tone="violet"/>
        <Stat icon={Coins} label="Coin" value={stats.coins} tone="gold"/>
        <Stat icon={Zap} label="XP" value={stats.xp} tone="coral"/>
      </section>

      <section className="st-grid-two">
        <div className="st-panel">
          <div className="st-panel-head"><div><span>GURUHLAR</span><h3>Faol guruhlar</h3></div><button type="button" onClick={() => setPage('groups')}>Barchasi</button></div>
          <div className="st-group-mini-list">
            {groups.map(group => {
              const list = students.filter(student => student.group === group);
              const xp = list.reduce((sum, student) => sum + Number(student.xp || 0), 0);
              return (
                <article key={group}>
                  <span className="st-group-icon"><Users size={18}/></span>
                  <div><strong>{group}</strong><small>{list.length} o‘quvchi</small></div>
                  <b>{xp} XP</b>
                </article>
              );
            })}
            {!groups.length && <Empty text="Hali guruh qo‘shilmagan."/>}
          </div>
        </div>

        <div className="st-panel">
          <div className="st-panel-head"><div><span>TOP 5</span><h3>Leaderboard</h3></div><button type="button" onClick={() => setPage('leaderboard')}>Ochish</button></div>
          <div className="st-top-list">
            {leaders.map((student, index) => (
              <article key={student.id}>
                <b>#{index + 1}</b>
                <span className="st-avatar">{student.name[0]?.toUpperCase()}</span>
                <div><strong>{student.name}</strong><small>{levelFor(student.xp).name} · {student.group}</small></div>
                <em>{student.xp || 0} XP</em>
              </article>
            ))}
            {!leaders.length && <Empty text="O‘quvchilar qo‘shilgach reyting chiqadi."/>}
          </div>
        </div>
      </section>

      <button type="button" className="st-daily-cta" onClick={() => setPage('daily')}>
        <span><Check size={22}/></span>
        <div><strong>Bugungi baholashni ochish</strong><small>Har bir o‘quvchini bir necha soniyada belgilang.</small></div>
        <b>Ochish</b>
      </button>
    </div>
  );
}

function DailyControl({
  groups,
  selectedGroup,
  setSelectedGroup,
  selectedDate,
  setSelectedDate,
  students,
  state,
  query,
  setQuery,
  updateDailyRecord,
  awardReward,
}) {
  const records = students.map(student => state.records?.[student.id]?.[selectedDate] || {});
  const markedAttendance = records.filter(record => record.attendance === 'present' || record.attendance === 'absent').length;
  const homeworkDone = records.filter(record => record.homework === 'done').length;
  const overallAverage = average(records.map(record => clampOverall(record.overall)).filter(value => value !== null));

  return (
    <div className="st-stack">
      <section className="st-daily-toolbar">
        <div className="st-group-tabs">
          {groups.map(group => (
            <button key={group} type="button" className={selectedGroup === group ? 'active' : ''} onClick={() => setSelectedGroup(group)}>{group}</button>
          ))}
        </div>
        <div className="st-toolbar-actions">
          <label className="st-date-field"><CalendarDays size={15}/><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}/></label>
          <label className="st-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="O‘quvchi qidirish"/></label>
        </div>
      </section>

      <section className="st-daily-summary">
        <div><span>Belgilangan</span><strong>{markedAttendance}/{students.length}</strong></div>
        <div><span>Vazifa qildi</span><strong>{homeworkDone}</strong></div>
        <div><span>Overall</span><strong>{fmtOverall(overallAverage)}</strong></div>
      </section>

      <section className="st-student-list">
        {students.map(student => {
          const record = state.records?.[student.id]?.[selectedDate] || {};
          const level = levelFor(student.xp);
          return (
            <article className="st-student-row" key={student.id}>
              <div className="st-student-main">
                <span className="st-avatar large">{student.name[0]?.toUpperCase()}</span>
                <div className="st-student-copy">
                  <strong>{student.name}</strong>
                  <small>{student.xp || 0} XP · {student.pts || 0} 🪙</small>
                  <div className="st-student-level">
                    <span>Level {level.level} · {level.name}</span>
                    <div className="st-level-progress"><i style={{ width: `${levelProgress(student.xp)}%` }}/></div>
                  </div>
                </div>
              </div>

              <div className="st-control-block">
                <span>Davomat</span>
                <div className="st-toggle-pair">
                  <button type="button" className={record.attendance === 'present' ? 'yes active' : 'yes'} onClick={() => updateDailyRecord(student.id, { attendance: 'present' })}><CheckCircle2 size={15}/> Keldi</button>
                  <button type="button" className={record.attendance === 'absent' ? 'no active' : 'no'} onClick={() => updateDailyRecord(student.id, { attendance: 'absent' })}><XCircle size={15}/> Kelmadi</button>
                </div>
              </div>

              <RewardControl studentId={student.id} onReward={awardReward}/>

              <div className="st-control-block">
                <span>Uyga vazifa</span>
                <div className="st-toggle-pair">
                  <button type="button" className={record.homework === 'done' ? 'yes active' : 'yes'} onClick={() => updateDailyRecord(student.id, { homework: 'done' })}><Check size={15}/> Qildi</button>
                  <button type="button" className={record.homework === 'notdone' ? 'no active' : 'no'} onClick={() => updateDailyRecord(student.id, { homework: 'notdone' })}><X size={15}/> Qilmadi</button>
                </div>
              </div>

              <label className="st-overall-field">
                <span>Overall</span>
                <select value={record.overall ?? ''} onChange={event => updateDailyRecord(student.id, { overall: clampOverall(event.target.value) })}>
                  <option value="">—</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(value => <option key={value} value={value}>{value}/10</option>)}
                </select>
              </label>
            </article>
          );
        })}
        {!students.length && <div className="st-panel"><Empty text="Bu guruhda o‘quvchi yo‘q."/></div>}
      </section>

      <section className="st-xp-rule">
        <Zap size={20}/>
        <div><strong>XP avtomatik hisoblanadi</strong><small>Keldi +3 XP · Uyga vazifa qildi +5 XP · Overall ×2 XP</small></div>
      </section>
    </div>
  );
}

function GroupsPage({ groups, students, state, onAddGroup, onAddStudent }) {
  return (
    <div className="st-stack">
      <section className="st-section-title">
        <div><span>GURUHLAR</span><h2>Guruh boshqaruvi</h2><p>Faqat kerakli guruh va o‘quvchilar.</p></div>
        <button type="button" className="st-primary-btn" onClick={onAddGroup}><Plus size={16}/> Guruh qo‘shish</button>
      </section>

      <section className="st-group-grid">
        {groups.map(group => {
          const list = students.filter(student => student.group === group);
          const totalXp = list.reduce((sum, student) => sum + Number(student.xp || 0), 0);
          const totalCoins = list.reduce((sum, student) => sum + Number(student.pts || 0), 0);
          return (
            <article className="st-group-card" key={group}>
              <div className="st-group-card-head">
                <span className="st-group-icon"><Users size={20}/></span>
                <div><small>GURUH</small><h3>{group}</h3></div>
                <strong>{list.length}</strong>
              </div>
              <div className="st-group-stats">
                <span><Zap size={14}/>{totalXp} XP</span>
                <span><Coins size={14}/>{totalCoins}</span>
              </div>
              <div className="st-group-students">
                {list.slice(0, 6).map(student => <span key={student.id}>{student.name}</span>)}
                {list.length > 6 && <span>+{list.length - 6} ta</span>}
                {!list.length && <span>Hali o‘quvchi yo‘q</span>}
              </div>
              <button type="button" onClick={() => onAddStudent(group)}><UserPlus size={15}/> O‘quvchi qo‘shish</button>
            </article>
          );
        })}
        {!groups.length && <div className="st-panel"><Empty text="Birinchi guruhni qo‘shing."/></div>}
      </section>
    </div>
  );
}

function Leaderboard({ groups, selectedGroup, setSelectedGroup, students }) {
  const top = [
    students[1] ? { student: students[1], rank: 2 } : null,
    students[0] ? { student: students[0], rank: 1 } : null,
    students[2] ? { student: students[2], rank: 3 } : null,
  ].filter(Boolean);

  return (
    <div className="st-stack">
      <section className="st-leader-head">
        <div><span>XP LEADERBOARD</span><h2>Reyting</h2><p>Asosiy reyting XP bo‘yicha. Coin teng holatlarda qo‘shimcha ustunlik beradi.</p></div>
        <div className="st-group-tabs">
          <button type="button" className={selectedGroup === 'all' ? 'active' : ''} onClick={() => setSelectedGroup('all')}>Barchasi</button>
          {groups.map(group => <button key={group} type="button" className={selectedGroup === group ? 'active' : ''} onClick={() => setSelectedGroup(group)}>{group}</button>)}
        </div>
      </section>

      {students.length ? (
        <>
          <section className="st-podium">
            {top.map(({ student, rank }) => {
              const Icon = rank === 1 ? Crown : rank === 2 ? Medal : Award;
              return (
                <article className={`rank-${rank}`} key={student.id}>
                  <Icon size={rank === 1 ? 29 : 24}/>
                  <span className="st-avatar podium">{student.name[0]?.toUpperCase()}</span>
                  <strong>#{rank}</strong>
                  <b>{student.name}</b>
                  <small>{levelFor(student.xp).name}</small>
                  <em>{student.xp || 0} XP · {student.pts || 0} 🪙</em>
                </article>
              );
            })}
          </section>

          <section className="st-panel st-ranking-list">
            {students.map((student, index) => {
              const level = levelFor(student.xp);
              const progress = levelProgress(student.xp);
              return (
                <article key={student.id}>
                  <strong className="st-rank">#{index + 1}</strong>
                  <span className="st-avatar">{student.name[0]?.toUpperCase()}</span>
                  <div className="st-rank-name">
                    <b>{student.name}</b>
                    <small>{student.group} · Level {level.level} {level.name}</small>
                    <div className="st-xp-bar"><i style={{ width: `${progress}%` }}/></div>
                  </div>
                  <span className="st-xp-value"><Zap size={14}/>{student.xp || 0}</span>
                  <span className="st-coin-value"><Coins size={14}/>{student.pts || 0}</span>
                </article>
              );
            })}
          </section>
        </>
      ) : <div className="st-panel"><Empty text="Reyting uchun o‘quvchi yo‘q."/></div>}
    </div>
  );
}

function RewardControl({ studentId, onReward }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('coin');

  const submit = () => {
    const value = Math.max(0, Math.round(Number(amount || 0)));
    if (!value) return;
    const applied = onReward(studentId, value, type);
    if (applied !== false) setAmount('');
  };

  return (
    <div className="st-reward-control">
      <span>Coin / XP</span>
      <div className="st-reward-line">
        <input
          type="number"
          min="1"
          inputMode="numeric"
          value={amount}
          onChange={event => setAmount(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') submit(); }}
          placeholder="0"
          aria-label="Mukofot miqdori"
        />
        <select value={type} onChange={event => setType(event.target.value)} aria-label="Mukofot turi">
          <option value="coin">Coin</option>
          <option value="xp">XP</option>
        </select>
        <button type="button" disabled={!Number(amount)} onClick={submit}>Berish</button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <article className={`st-stat tone-${tone}`}>
      <span><Icon size={20}/></span>
      <div><small>{label}</small><strong>{value}</strong></div>
    </article>
  );
}

function Empty({ text }) {
  return <div className="st-empty"><Users size={25}/><strong>Hozircha ma’lumot yo‘q</strong><span>{text}</span></div>;
}

function AddGroupModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  return (
    <Modal onClose={onClose} eyebrow="YANGI GURUH" title="Guruh qo‘shish">
      <label className="st-field"><span>Guruh nomi</span><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Masalan: IELTS"/></label>
      <button type="button" className="st-primary-btn full" disabled={!name.trim()} onClick={() => onAdd(name)}>Saqlash</button>
    </Modal>
  );
}

function AddStudentModal({ groups, initialGroup, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState(groups.includes(initialGroup) ? initialGroup : (groups[0] || ''));

  return (
    <Modal onClose={onClose} eyebrow="YANGI O‘QUVCHI" title="O‘quvchi qo‘shish">
      <label className="st-field"><span>Ism</span><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="O‘quvchi ismi"/></label>
      <label className="st-field"><span>Guruh</span><select value={group} onChange={event => setGroup(event.target.value)}>{groups.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <button type="button" className="st-primary-btn full" disabled={!name.trim() || !group} onClick={() => onAdd({ name, group })}>Saqlash</button>
    </Modal>
  );
}

function Modal({ onClose, eyebrow, title, children }) {
  return (
    <div className="st-modal-backdrop" onMouseDown={onClose}>
      <div className="st-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="st-modal-head"><div><span>{eyebrow}</span><h3>{title}</h3></div><button type="button" onClick={onClose}><X size={18}/></button></div>
        {children}
      </div>
    </div>
  );
}
