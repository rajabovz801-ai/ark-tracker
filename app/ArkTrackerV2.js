'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BookOpen, CalendarDays, Check, ChevronDown, CirclePlus, Coins,
  CreditCard, Crown, Download, GraduationCap, LayoutDashboard, Medal, Minus, Plus,
  Save, Search, ShieldCheck, ShoppingBag, Trash2, Trophy,
  Upload, UserCheck, UserCog, Users, Wallet, X, TrendingUp
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

const DEFAULT_COURSES = [
  { id: 'english', name: 'English' },
  { id: 'history', name: 'History' },
];

const DEFAULT_SHOP = [
  { id: 'shop-notebook', name: 'ARK Notebook', price: 300, stock: 20, active: true },
  { id: 'shop-pen', name: 'ARK Pen', price: 150, stock: 30, active: true },
  { id: 'shop-mock', name: 'Free Mock Exam', price: 800, stock: 999, active: true },
];

const STATE_KEY = 'ark-tracker-v1';
const LAST_GROUP_KEY = 'ark-tracker-last-group';
const LAST_COURSE_KEY = 'ark-tracker-last-course';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const seed = {
  students: [],
  records: {},
  taskLabels: {},
  lessonTopics: {},
  groups: ['IELTS', 'CEFR', '909'],
  deletedGroups: [],
  liveLessons: { IELTS: 0, CEFR: 0, '909': 0 },
  courses: DEFAULT_COURSES,
  groupMeta: {},
  staff: [],
  payments: {},
  coinTransactions: [],
  shopItems: DEFAULT_SHOP,
  shopOrders: [],
  schemaVersion: 3,
};

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `course-${Date.now()}`;
}

function uniqueCourses(courses) {
  const map = new Map();
  [...DEFAULT_COURSES, ...(Array.isArray(courses) ? courses : [])].forEach(c => {
    if (!c || !c.name) return;
    const id = c.id || slugify(c.name);
    if (!map.has(id)) map.set(id, { ...c, id });
  });
  return [...map.values()];
}

function normalizeState(raw) {
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const base = { ...seed, ...incoming };
  const courses = uniqueCourses(base.courses);
  const deleted = new Set(Array.isArray(base.deletedGroups) ? base.deletedGroups : []);
  const savedGroups = Array.isArray(base.groups) ? base.groups : [];
  const studentGroups = (Array.isArray(base.students) ? base.students : []).map(s => s?.group).filter(Boolean);
  const groups = [...new Set([...savedGroups, ...studentGroups])].filter(g => !deleted.has(g));
  const groupMeta = { ...(base.groupMeta || {}) };
  groups.forEach(group => {
    if (!groupMeta[group]) groupMeta[group] = { courseId: 'english', teacherId: '' };
    else groupMeta[group] = { teacherId: '', ...groupMeta[group], courseId: groupMeta[group].courseId || 'english' };
  });
  const students = (Array.isArray(base.students) ? base.students : []).map(s => {
    const groupCourse = groupMeta[s.group]?.courseId || 'english';
    return {
      ...s,
      id: s.id || crypto.randomUUID(),
      name: s.name || 'Student',
      courseId: s.courseId || groupCourse,
      pts: Number(s.pts || 0),
      xp: Number.isFinite(Number(s.xp)) ? Number(s.xp) : Number(s.pts || 0),
      parentName: s.parentName || '',
      parentPhone: s.parentPhone || '',
      phone: s.phone || '',
      monthlyFee: Number(s.monthlyFee || 0),
      archived: Boolean(s.archived),
    };
  });
  return {
    ...base,
    schemaVersion: 3,
    courses,
    groups,
    groupMeta,
    students,
    staff: Array.isArray(base.staff) ? base.staff : [],
    payments: base.payments && typeof base.payments === 'object' ? base.payments : {},
    coinTransactions: Array.isArray(base.coinTransactions) ? base.coinTransactions : [],
    shopItems: Array.isArray(base.shopItems) && base.shopItems.length ? base.shopItems : DEFAULT_SHOP,
    shopOrders: Array.isArray(base.shopOrders) ? base.shopOrders : [],
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

function localISODate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function planDateForToday() {
  const today = localISODate();
  if (DAY_PLAN.some(d => d.date === today)) return today;
  const past = DAY_PLAN.filter(d => d.date <= today).at(-1);
  return past?.date || DAY_PLAN[0].date;
}

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString('en-US')} UZS`;
}

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function taskState(value) {
  if (value === true || value === 'done') return 'done';
  if (value === 'partial') return 'partial';
  if (value === 'notdone') return 'notdone';
  return 'unset';
}
function taskScore(value) {
  const status = taskState(value);
  return status === 'done' ? 1 : status === 'partial' ? 0.5 : 0;
}
function levelFor(xp) {
  const n = Number(xp || 0);
  if (n >= 5000) return { name: 'Diamond', next: 5000 };
  if (n >= 3000) return { name: 'Gold', next: 5000 };
  if (n >= 1500) return { name: 'Silver', next: 3000 };
  if (n >= 500) return { name: 'Bronze', next: 1500 };
  return { name: 'Starter', next: 500 };
}
function assignedKeysFrom(state, group, date) {
  return MODULES.filter(m => String(state.taskLabels?.[group]?.[date]?.[m.key] || '').trim()).map(m => m.key);
}
function visibleGroups(state, courseId = 'all') {
  const deleted = new Set(Array.isArray(state.deletedGroups) ? state.deletedGroups : []);
  const saved = Array.isArray(state.groups) ? state.groups : [];
  const fromStudents = (state.students || []).map(s => s.group).filter(Boolean);
  return [...new Set([...saved, ...fromStudents])]
    .filter(g => !deleted.has(g))
    .filter(g => courseId === 'all' || (state.groupMeta?.[g]?.courseId || 'english') === courseId);
}
function studentsForCourse(state, courseId) {
  return (state.students || []).filter(s => !s.archived && (courseId === 'all' || (s.courseId || state.groupMeta?.[s.group]?.courseId || 'english') === courseId));
}

const NAV = [
  { key: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'Daily', label: 'Daily control', icon: CalendarDays },
  { key: 'Students', label: 'Students', icon: Users },
  { key: 'Groups', label: 'Groups', icon: BookOpen },
  { key: 'Staff', label: 'Teachers & Admin', icon: UserCog },
  { key: 'Finance', label: 'Finance', icon: CreditCard },
  { key: 'Gamification', label: 'Gamification', icon: Trophy },
  { key: 'Shop', label: 'Shop', icon: ShoppingBag },
  { key: 'Leaderboard', label: 'Leaderboard', icon: Crown },
  { key: 'Black list', label: 'Black list', icon: AlertTriangle },
];

export default function Home() {
  const [state, setState] = useState(seed);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('Dashboard');
  const [activeCourseId, setActiveCourseId] = useState('english');
  const [controlGroup, setControlGroup] = useState('');
  const [selectedDate, setSelectedDate] = useState(DAY_PLAN[0].date);
  const [query, setQuery] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const restoreRef = useRef(null);

  useEffect(() => {
    const loaded = loadState();
    const savedCourse = localStorage.getItem(LAST_COURSE_KEY);
    const course = loaded.courses.some(c => c.id === savedCourse) ? savedCourse : 'english';
    const groups = visibleGroups(loaded, course);
    const savedGroup = localStorage.getItem(LAST_GROUP_KEY);
    setState(loaded);
    setActiveCourseId(course);
    setControlGroup(groups.includes(savedGroup) ? savedGroup : (groups[0] || ''));
    setSelectedDate(planDateForToday());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(LAST_COURSE_KEY, activeCourseId);
  }, [activeCourseId, ready]);
  useEffect(() => {
    if (ready && controlGroup) localStorage.setItem(LAST_GROUP_KEY, controlGroup);
  }, [controlGroup, ready]);

  const courses = state.courses || DEFAULT_COURSES;
  const groups = useMemo(() => visibleGroups(state, activeCourseId), [state, activeCourseId]);
  const courseStudents = useMemo(() => studentsForCourse(state, activeCourseId), [state, activeCourseId]);
  const allStudents = useMemo(() => studentsForCourse(state, 'all'), [state]);
  const activeCourse = courses.find(c => c.id === activeCourseId);

  useEffect(() => {
    if (groups.length && !groups.includes(controlGroup)) setControlGroup(groups[0]);
    if (!groups.length) setControlGroup('');
  }, [groups, controlGroup]);

  const scoped = useMemo(() => {
    return courseStudents
      .filter(s => !controlGroup || s.group === controlGroup)
      .filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  }, [courseStudents, controlGroup, query]);

  const monthlyCollected = useMemo(() => {
    const month = currentMonthKey();
    return courseStudents.reduce((sum, s) => sum + Number(state.payments?.[s.id]?.[month]?.amount || 0), 0);
  }, [courseStudents, state.payments]);

  const dashboardStats = useMemo(() => {
    let present = 0, absent = 0, score = 0, possible = 0;
    courseStudents.forEach(s => {
      DAY_PLAN.forEach(d => {
        if (d.rest) return;
        const rec = state.records?.[s.id]?.[d.date] || {};
        if (rec.attendance === 'present') present++;
        if (rec.attendance === 'absent') absent++;
        assignedKeysFrom(state, s.group, d.date).forEach(k => {
          possible++;
          score += taskScore(rec.modules?.[k]);
        });
      });
    });
    return {
      students: courseStudents.length,
      groups: groups.length,
      staff: (state.staff || []).filter(x => activeCourseId === 'all' || (x.courseIds || []).includes(activeCourseId)).length,
      attendance: pct(present, present + absent),
      homework: pct(score, possible),
      coins: courseStudents.reduce((sum, s) => sum + Number(s.pts || 0), 0),
    };
  }, [courseStudents, groups.length, state, activeCourseId]);

  const dailySummary = useMemo(() => {
    const list = courseStudents.filter(s => s.group === controlGroup);
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
    return { students: list.length, done, partial, notDone, present, absent, assigned: active.length, progress: pct(score, list.length * active.length) };
  }, [courseStudents, controlGroup, selectedDate, state]);

  const blackList = useMemo(() => {
    const today = localISODate();
    return courseStudents.map(student => {
      let streak = 0;
      let streakDays = [];
      DAY_PLAN.forEach(day => {
        if (day.rest || day.date > today) return;
        const active = assignedKeysFrom(state, student.group, day.date);
        if (!active.length) return;
        const statuses = active.map(key => taskState(state.records?.[student.id]?.[day.date]?.modules?.[key]));
        let result = null;
        if (day.date === today) {
          if (statuses.some(s => s === 'partial' || s === 'notdone')) result = 'bad';
          else if (statuses.every(s => s === 'done')) result = 'good';
          else result = 'pending';
        } else result = statuses.every(s => s === 'done') ? 'good' : 'bad';
        if (result === 'bad') { streak += 1; streakDays.push(day.label); }
        else if (result === 'good') { streak = 0; streakDays = []; }
      });
      return streak >= 2 ? { student, streak, days: streakDays.slice(-2) } : null;
    }).filter(Boolean).sort((a,b) => b.streak - a.streak);
  }, [courseStudents, state]);

  const addCourse = name => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const existing = courses.find(c => c.name.toLowerCase() === clean.toLowerCase());
    if (existing) { setActiveCourseId(existing.id); setShowAddCourse(false); return; }
    let id = slugify(clean);
    if (courses.some(c => c.id === id)) id = `${id}-${Date.now()}`;
    setState(p => ({ ...p, courses: [...(p.courses || []), { id, name: clean }] }));
    setActiveCourseId(id);
    setShowAddCourse(false);
  };

  const addGroup = (name, courseId) => {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean || !courseId) return;
    const existing = (state.groups || []).find(g => g.toLowerCase() === clean.toLowerCase());
    if (existing) {
      setState(p => ({ ...p, groupMeta: { ...(p.groupMeta || {}), [existing]: { ...(p.groupMeta?.[existing] || {}), courseId } } }));
      setActiveCourseId(courseId);
      setControlGroup(existing);
      setShowAddGroup(false);
      return;
    }
    setState(p => ({
      ...p,
      groups: [...new Set([...(p.groups || []), clean])],
      deletedGroups: (p.deletedGroups || []).filter(g => g.toLowerCase() !== clean.toLowerCase()),
      groupMeta: { ...(p.groupMeta || {}), [clean]: { courseId, teacherId: '' } },
      liveLessons: { ...(p.liveLessons || {}), [clean]: p.liveLessons?.[clean] || 0 },
    }));
    setActiveCourseId(courseId);
    setControlGroup(clean);
    setShowAddGroup(false);
  };

  const addStudent = data => {
    if (!data.name?.trim() || !data.group) return;
    const groupCourse = state.groupMeta?.[data.group]?.courseId || data.courseId || 'english';
    const student = {
      id: crypto.randomUUID(), name: data.name.trim(), group: data.group, courseId: groupCourse,
      pts: 0, xp: 0, phone: data.phone || '', parentName: data.parentName || '', parentPhone: data.parentPhone || '',
      monthlyFee: Number(data.monthlyFee || 0), archived: false,
    };
    setState(p => ({ ...p, students: [...(p.students || []), student] }));
    setShowAddStudent(false);
  };

  const updateStudent = (id, patch) => setState(p => ({
    ...p,
    students: (p.students || []).map(s => s.id === id ? { ...s, ...patch } : s),
  }));

  const archiveStudent = id => {
    if (!window.confirm('Archive this student? All historical data will stay in the database.')) return;
    updateStudent(id, { archived: true });
  };

  const addStaff = data => {
    if (!data.name?.trim()) return;
    setState(p => ({
      ...p,
      staff: [...(p.staff || []), {
        id: crypto.randomUUID(), name: data.name.trim(), role: data.role || 'teacher', phone: data.phone || '',
        courseIds: data.courseIds?.length ? data.courseIds : ['english'], active: true,
      }]
    }));
    setShowAddStaff(false);
  };

  const setGroupTeacher = (group, teacherId) => setState(p => ({
    ...p,
    groupMeta: { ...(p.groupMeta || {}), [group]: { ...(p.groupMeta?.[group] || {}), teacherId } }
  }));

  const setAttendance = (id, date, value) => setState(p => {
    const oldDay = p.records?.[id]?.[date] || {};
    const current = oldDay.attendance;
    const { attendance: _attendance, ...withoutAttendance } = oldDay;
    const nextDay = current === value
      ? { ...withoutAttendance, modules: oldDay.modules || {} }
      : { ...oldDay, attendance: value, modules: oldDay.modules || {} };
    return { ...p, records: { ...(p.records || {}), [id]: { ...(p.records?.[id] || {}), [date]: nextDay } } };
  });

  const toggleModule = (id, date, key) => setState(p => {
    const current = taskState(p.records?.[id]?.[date]?.modules?.[key]);
    const next = current === 'unset' ? 'partial' : current === 'partial' ? 'done' : current === 'done' ? 'notdone' : 'unset';
    const modules = { ...(p.records?.[id]?.[date]?.modules || {}) };
    if (next === 'unset') delete modules[key]; else modules[key] = next;
    return { ...p, records: { ...(p.records || {}), [id]: { ...(p.records?.[id] || {}), [date]: { ...(p.records?.[id]?.[date] || {}), modules } } } };
  });

  const setTaskLabel = (group, date, key, value) => setState(p => ({
    ...p,
    taskLabels: { ...(p.taskLabels || {}), [group]: { ...(p.taskLabels?.[group] || {}), [date]: { ...(p.taskLabels?.[group]?.[date] || {}), [key]: value } } }
  }));
  const setLessonTopic = (group, date, value) => setState(p => ({
    ...p,
    lessonTopics: { ...(p.lessonTopics || {}), [group]: { ...(p.lessonTopics?.[group] || {}), [date]: value } }
  }));

  const awardCoins = (id, delta, reason = 'Manual reward') => {
    const amount = Number(delta || 0);
    if (!amount) return;
    const student = state.students.find(s => s.id === id);
    if (!student) return;
    const nextBalance = Math.max(0, Number(student.pts || 0) + amount);
    const applied = nextBalance - Number(student.pts || 0);
    setState(p => ({
      ...p,
      students: (p.students || []).map(s => s.id === id ? { ...s, pts: nextBalance, xp: Math.max(0, Number(s.xp || 0) + (applied > 0 ? applied : 0)) } : s),
      coinTransactions: [{ id: crypto.randomUUID(), studentId: id, amount: applied, reason, createdAt: new Date().toISOString() }, ...(p.coinTransactions || [])].slice(0, 1000),
    }));
  };

  const setPayment = (studentId, monthKey, amount) => setState(p => ({
    ...p,
    payments: {
      ...(p.payments || {}),
      [studentId]: {
        ...(p.payments?.[studentId] || {}),
        [monthKey]: { amount: Math.max(0, Number(amount || 0)), paidAt: Number(amount || 0) > 0 ? new Date().toISOString() : null }
      }
    }
  }));

  const addShopItem = item => {
    if (!item.name?.trim() || Number(item.price) <= 0) return;
    setState(p => ({ ...p, shopItems: [...(p.shopItems || []), { id: crypto.randomUUID(), name: item.name.trim(), price: Number(item.price), stock: Math.max(0, Number(item.stock || 0)), active: true }] }));
  };

  const buyItem = (studentId, itemId) => {
    const student = state.students.find(s => s.id === studentId);
    const item = state.shopItems.find(x => x.id === itemId);
    if (!student || !item || item.active === false) return;
    if (Number(item.stock || 0) <= 0) return window.alert('This item is out of stock.');
    if (Number(student.pts || 0) < Number(item.price || 0)) return window.alert('Student does not have enough ARK Coins.');
    setState(p => ({
      ...p,
      students: (p.students || []).map(s => s.id === studentId ? { ...s, pts: Number(s.pts || 0) - Number(item.price || 0) } : s),
      shopItems: (p.shopItems || []).map(x => x.id === itemId ? { ...x, stock: Math.max(0, Number(x.stock || 0) - 1) } : x),
      shopOrders: [{ id: crypto.randomUUID(), studentId, itemId, price: Number(item.price || 0), status: 'pending', createdAt: new Date().toISOString() }, ...(p.shopOrders || [])],
      coinTransactions: [{ id: crypto.randomUUID(), studentId, amount: -Number(item.price || 0), reason: `Shop: ${item.name}`, createdAt: new Date().toISOString() }, ...(p.coinTransactions || [])].slice(0, 1000),
    }));
  };

  const setOrderStatus = (id, status) => setState(p => ({
    ...p,
    shopOrders: (p.shopOrders || []).map(o => o.id === id ? { ...o, status } : o)
  }));

  const backupData = () => {
    const payload = { app: 'ARK Tracker', version: 3, exportedAt: new Date().toISOString(), data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ark-tracker-backup-${localISODate()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const restoreData = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      if (!data || !Array.isArray(data.students) || typeof data.records !== 'object') throw new Error('Invalid');
      if (!window.confirm('Restore this backup? Current state will be replaced, but the server backup created before this expansion remains safe.')) return;
      const next = normalizeState(data);
      setState(next);
      setActiveCourseId('english');
      setControlGroup(visibleGroups(next, 'english')[0] || '');
      setPage('Dashboard');
    } catch { window.alert('This is not a valid ARK Tracker backup file.'); }
  };

  const dateInfo = DAY_PLAN.find(d => d.date === selectedDate);
  const currentTopic = state.lessonTopics?.[controlGroup]?.[selectedDate] || '';
  const courseLabel = activeCourseId === 'all' ? 'All courses' : (activeCourse?.name || 'Course');

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><b>ARK</b><span>TRACKER</span></div></div>
        <div className="side-section-label">Workspace</div>
        <nav>
          {NAV.map(item => {
            const Icon = item.icon;
            const count = item.key === 'Black list' ? blackList.length : null;
            return <button key={item.key} className={page === item.key ? 'active' : ''} onClick={() => setPage(item.key)}><Icon size={18}/>{item.label}{count ? <span className="nav-count">{count}</span> : null}</button>;
          })}
        </nav>
        <div className="sidebar-note"><ShieldCheck size={18}/><div><b>Cloud protected</b><span>Existing data is preserved</span></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="top-title"><span className="eyebrow">ARK EDUCATION CENTRE</span><h1>{page}</h1><p>{courseLabel} workspace</p></div>
          <div className="top-actions">
            <label className="course-switcher">
              <GraduationCap size={17}/>
              <select value={activeCourseId} onChange={e => setActiveCourseId(e.target.value)}>
                <option value="all">All courses</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select><ChevronDown size={14}/>
            </label>
            <button className="ghost" onClick={backupData}><Download size={16}/> Backup</button>
            <button className="ghost" onClick={() => restoreRef.current?.click()}><Upload size={16}/> Restore</button>
            <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={restoreData}/>
          </div>
        </header>

        {page === 'Dashboard' && <Dashboard state={state} students={courseStudents} groups={groups} stats={dashboardStats} monthlyCollected={monthlyCollected} setPage={setPage}/>} 
        {page === 'Daily' && <DailyControl state={state} groups={groups} scoped={scoped} controlGroup={controlGroup} setControlGroup={setControlGroup} query={query} setQuery={setQuery} selectedDate={selectedDate} setSelectedDate={setSelectedDate} dateInfo={dateInfo} currentTopic={currentTopic} dailySummary={dailySummary} setAttendance={setAttendance} toggleModule={toggleModule} setTaskLabel={setTaskLabel} setLessonTopic={setLessonTopic} awardCoins={awardCoins} setState={setState}/>} 
        {page === 'Students' && <StudentsPage students={courseStudents} state={state} updateStudent={updateStudent} archiveStudent={archiveStudent} awardCoins={awardCoins} onAdd={() => setShowAddStudent(true)}/>} 
        {page === 'Groups' && <GroupsPage state={state} groups={groups} activeCourseId={activeCourseId} setGroupTeacher={setGroupTeacher} onAddGroup={() => setShowAddGroup(true)} onAddCourse={() => setShowAddCourse(true)}/>} 
        {page === 'Staff' && <StaffPage staff={state.staff || []} courses={courses} activeCourseId={activeCourseId} onAdd={() => setShowAddStaff(true)}/>} 
        {page === 'Finance' && <FinancePage students={courseStudents} payments={state.payments || {}} updateStudent={updateStudent} setPayment={setPayment}/>} 
        {page === 'Gamification' && <GamificationPage students={courseStudents} transactions={state.coinTransactions || []} awardCoins={awardCoins}/>} 
        {page === 'Shop' && <ShopPage students={courseStudents} items={state.shopItems || []} orders={state.shopOrders || []} allStudents={allStudents} addShopItem={addShopItem} buyItem={buyItem} setOrderStatus={setOrderStatus}/>} 
        {page === 'Leaderboard' && <LeaderboardPage students={courseStudents}/>} 
        {page === 'Black list' && <BlackListPage items={blackList}/>} 
      </section>

      {showAddStudent && <AddStudentModal state={state} courses={courses} initialCourseId={activeCourseId === 'all' ? 'english' : activeCourseId} onClose={() => setShowAddStudent(false)} onAdd={addStudent}/>} 
      {showAddGroup && <AddGroupModal courses={courses} initialCourseId={activeCourseId === 'all' ? 'english' : activeCourseId} onClose={() => setShowAddGroup(false)} onAdd={addGroup}/>} 
      {showAddCourse && <SimpleNameModal eyebrow="NEW COURSE" title="Add course" placeholder="e.g. Mathematics" onClose={() => setShowAddCourse(false)} onAdd={addCourse}/>} 
      {showAddStaff && <AddStaffModal courses={courses} initialCourseId={activeCourseId === 'all' ? 'english' : activeCourseId} onClose={() => setShowAddStaff(false)} onAdd={addStaff}/>} 
    </main>
  );
}

function Dashboard({state, students, groups, stats, monthlyCollected, setPage}) {
  const leaders = [...students].sort((a,b) => Number(b.pts||0)-Number(a.pts||0)).slice(0,5);
  const groupCards = groups.map(group => {
    const list = students.filter(s => s.group === group);
    const teacherId = state.groupMeta?.[group]?.teacherId;
    const teacher = (state.staff || []).find(s => s.id === teacherId)?.name || 'Unassigned';
    return { group, count: list.length, teacher, live: state.liveLessons?.[group] || 0 };
  });
  return <div className="page-stack">
    <section className="kpi-grid">
      <Kpi icon={Users} label="Active students" value={stats.students} hint="current course"/>
      <Kpi icon={BookOpen} label="Groups" value={stats.groups} hint="active groups"/>
      <Kpi icon={UserCog} label="Teachers / Admin" value={stats.staff} hint="assigned staff"/>
      <Kpi icon={UserCheck} label="Attendance" value={`${stats.attendance}%`} hint="marked lessons"/>
      <Kpi icon={TrendingUp} label="Homework" value={`${stats.homework}%`} hint="submitted score"/>
      <Kpi icon={Coins} label="ARK Coins" value={stats.coins.toLocaleString()} hint="student balances"/>
      <Kpi icon={Wallet} label="This month" value={fmtMoney(monthlyCollected)} hint="collected payments" wide/>
    </section>

    <section className="dashboard-grid">
      <div className="panel">
        <PanelHead eyebrow="COURSE STRUCTURE" title="Groups" action={<button className="text-btn" onClick={() => setPage('Groups')}>Manage</button>}/>
        {groupCards.length ? <div className="group-mini-list">{groupCards.map(g => <div className="group-mini" key={g.group}><div className="group-icon"><BookOpen size={18}/></div><div><b>{g.group}</b><span>{g.count} students · {g.teacher}</span></div><strong>{g.live}/wk</strong></div>)}</div> : <Empty text="No groups in this course yet."/>}
      </div>
      <div className="panel">
        <PanelHead eyebrow="TOP BALANCES" title="Leaderboard" action={<button className="text-btn" onClick={() => setPage('Leaderboard')}>View all</button>}/>
        {leaders.length ? <div className="leader-list">{leaders.map((s,i) => <LeaderRow key={s.id} student={s} rank={i+1}/>)}</div> : <Empty text="Add students to start ranking."/>}
      </div>
    </section>

    <section className="panel quick-links">
      <PanelHead eyebrow="MANAGEMENT" title="Quick actions"/>
      <div className="quick-grid">
        <Quick icon={CalendarDays} title="Daily control" text="Attendance, topic and homework" onClick={() => setPage('Daily')}/>
        <Quick icon={CreditCard} title="Finance" text="Parents and monthly payments" onClick={() => setPage('Finance')}/>
        <Quick icon={Trophy} title="Gamification" text="Coins, XP and rewards" onClick={() => setPage('Gamification')}/>
        <Quick icon={ShoppingBag} title="ARK Shop" text="Spend coins on rewards" onClick={() => setPage('Shop')}/>
      </div>
    </section>
  </div>;
}

function DailyControl({state, groups, scoped, controlGroup, setControlGroup, query, setQuery, selectedDate, setSelectedDate, dateInfo, currentTopic, dailySummary, setAttendance, toggleModule, setTaskLabel, setLessonTopic, awardCoins, setState}) {
  if (!groups.length) return <section className="panel"><Empty text="Add a group to this course first."/></section>;
  return <div className="page-stack">
    <section className="panel daily-toolbar">
      <div><span className="eyebrow">DAILY CONTROL</span><h2>{controlGroup} · {dateInfo?.label}</h2><p>Topic, homework, attendance and rewards in one place.</p></div>
      <div className="controls">
        <label className="select-wrap"><Users size={16}/><select value={controlGroup} onChange={e => setControlGroup(e.target.value)}>{groups.map(g => <option key={g}>{g}</option>)}</select><ChevronDown size={14}/></label>
        <label className="select-wrap"><CalendarDays size={16}/><select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>{DAY_PLAN.map(d => <option key={d.date} value={d.date}>{d.label} · {d.day}{d.rest ? ' · No lesson' : ''}</option>)}</select><ChevronDown size={14}/></label>
      </div>
    </section>
    <section className="kpi-grid compact">
      <Kpi icon={Users} label="Students" value={dailySummary.students} hint={controlGroup}/>
      <Kpi icon={Check} label="Done" value={dailySummary.done} hint="homework"/>
      <Kpi icon={Minus} label="Partial" value={dailySummary.partial} hint="50%"/>
      <Kpi icon={AlertTriangle} label="Not done" value={dailySummary.notDone} hint="homework"/>
      <Kpi icon={UserCheck} label="Absent" value={dailySummary.absent} hint={`${dailySummary.present} present`}/>
      <Kpi icon={TrendingUp} label="Progress" value={`${dailySummary.progress}%`} hint="today"/>
    </section>
    {dateInfo?.rest ? <section className="panel rest-card"><CalendarDays size={30}/><div><b>No lesson</b><span>{dateInfo.label} is marked as a rest day.</span></div></section> : <>
      <section className="panel lesson-setup">
        <PanelHead eyebrow="LESSON SETUP" title="Topic & homework"/>
        <label className="field"><span>Lesson topic</span><input value={currentTopic} onChange={e => setLessonTopic(controlGroup, selectedDate, e.target.value)} placeholder="e.g. Reading — Matching Headings"/></label>
        <div className="homework-fields">{MODULES.map((m,i) => <label className="field" key={m.key}><span>Homework {i+1}</span><input value={state.taskLabels?.[controlGroup]?.[selectedDate]?.[m.key] || ''} onChange={e => setTaskLabel(controlGroup, selectedDate, m.key, e.target.value)} placeholder="Write task"/></label>)}</div>
      </section>
      <section className="panel tracker-panel">
        <div className="panel-head"><div><span className="eyebrow">STUDENT CHECK</span><h2>Attendance & homework</h2></div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search student"/></label></div>
        {scoped.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Attendance</th>{MODULES.map((m,i)=><th key={m.key}>HW {i+1}</th>)}<th>Coins</th></tr></thead><tbody>{scoped.map(s=>{
          const rec = state.records?.[s.id]?.[selectedDate] || {};
          return <tr key={s.id}><td><StudentCell student={s}/></td><td><div className="attendance-buttons"><button className={rec.attendance==='present'?'present on':'present'} onClick={()=>setAttendance(s.id,selectedDate,'present')}><Check size={14}/>Present</button><button className={rec.attendance==='absent'?'absent on':'absent'} onClick={()=>setAttendance(s.id,selectedDate,'absent')}><X size={14}/>Absent</button></div></td>{MODULES.map(m=>{
            const label = String(state.taskLabels?.[controlGroup]?.[selectedDate]?.[m.key] || '').trim();
            const status = taskState(rec.modules?.[m.key]);
            return <td key={m.key}><button disabled={!label} className={`task-check ${status}`} onClick={()=>label&&toggleModule(s.id,selectedDate,m.key)}>{status==='done'?<Check size={17}/>:status==='partial'?'◐':<Minus size={17}/>}</button></td>;
          })}<td><div className="coin-stepper"><button onClick={()=>awardCoins(s.id,-1,'Daily manual adjustment')}><Minus size={13}/></button><strong>{s.pts||0}</strong><button onClick={()=>awardCoins(s.id,1,'Daily reward')}><Plus size={13}/></button></div></td></tr>;
        })}</tbody></table></div> : <Empty text="No students in this group."/>}
      </section>
      <section className="panel live-panel"><PanelHead eyebrow="LIVE LESSONS" title="Weekly counter"/><div className="live-row"><div><b>{controlGroup}</b><span>live lessons / week</span></div><div className="coin-stepper"><button onClick={()=>setState(p=>({...p,liveLessons:{...(p.liveLessons||{}),[controlGroup]:Math.max(0,(p.liveLessons?.[controlGroup]||0)-1)}}))}><Minus size={13}/></button><strong>{state.liveLessons?.[controlGroup]||0}</strong><button onClick={()=>setState(p=>({...p,liveLessons:{...(p.liveLessons||{}),[controlGroup]:(p.liveLessons?.[controlGroup]||0)+1}}))}><Plus size={13}/></button></div></div></section>
    </>}
  </div>;
}

function StudentsPage({students, state, updateStudent, archiveStudent, awardCoins, onAdd}) {
  const [q,setQ]=useState('');
  const list=students.filter(s=>s.name.toLowerCase().includes(q.toLowerCase()));
  return <div className="page-stack"><section className="panel"><div className="panel-head"><div><span className="eyebrow">STUDENT DIRECTORY</span><h2>{students.length} active students</h2></div><div className="row-actions"><label className="search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search"/></label><button className="primary" onClick={onAdd}><CirclePlus size={17}/>Add student</button></div></div>{list.length?<div className="table-wrap"><table><thead><tr><th>Student</th><th>Course / Group</th><th>Parent</th><th>Phone</th><th>Coins / XP</th><th></th></tr></thead><tbody>{list.map(s=><tr key={s.id}><td><StudentCell student={s}/></td><td><span className="tag">{state.courses?.find(c=>c.id===s.courseId)?.name || 'English'}</span><small className="subline">{s.group}</small></td><td><input className="table-input" value={s.parentName||''} onChange={e=>updateStudent(s.id,{parentName:e.target.value})} placeholder="Parent name"/></td><td><input className="table-input" value={s.parentPhone||''} onChange={e=>updateStudent(s.id,{parentPhone:e.target.value})} placeholder="+998..."/></td><td><div className="balance-cell"><b>{s.pts||0} 🪙</b><span>{s.xp||0} XP · {levelFor(s.xp).name}</span></div></td><td><div className="row-actions"><button className="icon-btn" title="+5 coins" onClick={()=>awardCoins(s.id,5,'Teacher quick reward')}><Plus size={15}/></button><button className="icon-danger" title="Archive (data stays safe)" onClick={()=>archiveStudent(s.id)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>:<Empty text="No students match this course."/>}</section></div>;
}

function GroupsPage({state, groups, activeCourseId, setGroupTeacher, onAddGroup, onAddCourse}) {
  const teachers=(state.staff||[]).filter(s=>s.active!==false&&s.role==='teacher');
  return <div className="page-stack"><section className="panel"><div className="panel-head"><div><span className="eyebrow">COURSES & GROUPS</span><h2>Structure</h2><p>Existing groups are kept under English; new subjects can have their own groups.</p></div><div className="row-actions"><button className="ghost" onClick={onAddCourse}><Plus size={16}/>Add course</button><button className="primary" onClick={onAddGroup}><Plus size={16}/>Add group</button></div></div><div className="course-strip">{(state.courses||[]).map(c=><div key={c.id} className={`course-card ${activeCourseId===c.id?'selected':''}`}><GraduationCap size={20}/><div><b>{c.name}</b><span>{visibleGroups(state,c.id).length} groups</span></div></div>)}</div></section><section className="group-card-grid">{groups.map(group=>{
    const count=(state.students||[]).filter(s=>!s.archived&&s.group===group).length;
    const meta=state.groupMeta?.[group]||{};
    return <div className="panel group-card" key={group}><div className="group-card-top"><div className="group-icon"><BookOpen size={19}/></div><div><span className="eyebrow">GROUP</span><h3>{group}</h3></div><strong>{count}</strong></div><div className="group-meta"><span>Students <b>{count}</b></span><span>Lessons / week <b>{state.liveLessons?.[group]||0}</b></span></div><label className="field"><span>Teacher</span><select value={meta.teacherId||''} onChange={e=>setGroupTeacher(group,e.target.value)}><option value="">Unassigned</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>;
  })}{!groups.length&&<div className="panel"><Empty text="No groups yet. Add one to this course."/></div>}</section></div>;
}

function StaffPage({staff,courses,activeCourseId,onAdd}) {
  const list=staff.filter(s=>s.active!==false&&(activeCourseId==='all'||(s.courseIds||[]).includes(activeCourseId)));
  const teachers=list.filter(s=>s.role==='teacher').length;
  const admins=list.filter(s=>s.role==='admin').length;
  return <div className="page-stack"><section className="kpi-grid compact"><Kpi icon={UserCog} label="Staff" value={list.length} hint="active"/><Kpi icon={BookOpen} label="Teachers" value={teachers} hint="teaching staff"/><Kpi icon={ShieldCheck} label="Admins" value={admins} hint="management"/></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">STAFF DIRECTORY</span><h2>Teachers & Admin</h2></div><button className="primary" onClick={onAdd}><Plus size={16}/>Add staff</button></div>{list.length?<div className="staff-grid">{list.map(s=><div className="staff-card" key={s.id}><div className="avatar large">{s.name[0]?.toUpperCase()}</div><div className="staff-main"><b>{s.name}</b><span className={`role-badge ${s.role}`}>{s.role}</span><small>{s.phone||'No phone'}</small></div><div className="staff-courses">{(s.courseIds||[]).map(id=><span key={id}>{courses.find(c=>c.id===id)?.name||id}</span>)}</div></div>)}</div>:<Empty text="Add teachers and admins to manage courses."/>}</section></div>;
}

function FinancePage({students,payments,updateStudent,setPayment}) {
  const [year,setYear]=useState(new Date().getFullYear());
  const [q,setQ]=useState('');
  const list=students.filter(s=>s.name.toLowerCase().includes(q.toLowerCase()));
  const total=list.reduce((sum,s)=>sum+MONTHS.reduce((a,_,i)=>a+Number(payments?.[s.id]?.[`${year}-${String(i+1).padStart(2,'0')}`]?.amount||0),0),0);
  return <div className="page-stack"><section className="kpi-grid compact"><Kpi icon={CreditCard} label={`${year} collected`} value={fmtMoney(total)} hint="visible students"/><Kpi icon={Users} label="Students" value={list.length} hint="finance records"/></section><section className="panel finance-panel"><div className="panel-head"><div><span className="eyebrow">FINANCE</span><h2>Parents & monthly payments</h2><p>Every month is stored separately for each student.</p></div><div className="row-actions"><input className="year-input" type="number" value={year} onChange={e=>setYear(Number(e.target.value)||2026)}/><label className="search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search student"/></label></div></div>{list.length?<div className="table-wrap finance-table"><table><thead><tr><th className="sticky-col">Student</th><th>Parent</th><th>Parent phone</th><th>Monthly fee</th>{MONTHS.map(m=><th key={m}>{m}</th>)}<th>Total</th></tr></thead><tbody>{list.map(s=>{
    const annual=MONTHS.reduce((a,_,i)=>a+Number(payments?.[s.id]?.[`${year}-${String(i+1).padStart(2,'0')}`]?.amount||0),0);
    return <tr key={s.id}><td className="sticky-col"><StudentCell student={s}/></td><td><input className="finance-input text" value={s.parentName||''} onChange={e=>updateStudent(s.id,{parentName:e.target.value})} placeholder="Name"/></td><td><input className="finance-input text" value={s.parentPhone||''} onChange={e=>updateStudent(s.id,{parentPhone:e.target.value})} placeholder="+998"/></td><td><input className="finance-input money" type="number" value={s.monthlyFee||''} onChange={e=>updateStudent(s.id,{monthlyFee:Number(e.target.value||0)})} placeholder="0"/></td>{MONTHS.map((m,i)=>{const key=`${year}-${String(i+1).padStart(2,'0')}`;const amount=payments?.[s.id]?.[key]?.amount||'';return <td key={key}><input className={`finance-input month ${Number(amount)>0?'paid':''}`} type="number" value={amount} onChange={e=>setPayment(s.id,key,e.target.value)} placeholder="0" title={`${m} ${year}`}/></td>})}<td><b>{fmtMoney(annual)}</b></td></tr>;
  })}</tbody></table></div>:<Empty text="No students in this course."/>}</section></div>;
}

function GamificationPage({students,transactions,awardCoins}) {
  const [studentId,setStudentId]=useState(students[0]?.id||'');
  const [amount,setAmount]=useState(10);
  const [reason,setReason]=useState('Teacher reward');
  useEffect(()=>{if(students.length&&!students.some(s=>s.id===studentId))setStudentId(students[0].id)},[students,studentId]);
  const leaders=[...students].sort((a,b)=>Number(b.xp||0)-Number(a.xp||0));
  const tx=transactions.filter(t=>students.some(s=>s.id===t.studentId)).slice(0,20);
  return <div className="page-stack"><section className="panel gamification-hero"><div><span className="eyebrow">ARK REWARD ECONOMY</span><h2>Coins + XP</h2><p>Coins can be spent in the shop. XP never decreases and controls the student level.</p></div><div className="reward-form"><select value={studentId} onChange={e=>setStudentId(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value)||0)}/><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason"/><button className="primary" onClick={()=>awardCoins(studentId,amount,reason)}><Coins size={16}/>Give coins</button></div></section><section className="dashboard-grid"><div className="panel"><PanelHead eyebrow="LEVELS" title="Student progress"/><div className="level-list">{leaders.slice(0,12).map((s,i)=>{const level=levelFor(s.xp);const prev=level.name==='Starter'?0:level.name==='Bronze'?500:level.name==='Silver'?1500:level.name==='Gold'?3000:5000;const denom=Math.max(1,level.next-prev);const prog=level.name==='Diamond'?100:Math.min(100,Math.round(((Number(s.xp||0)-prev)/denom)*100));return <div className="level-row" key={s.id}><span className="rank-num">#{i+1}</span><div className="avatar">{s.name[0]?.toUpperCase()}</div><div className="grow"><div className="level-name"><b>{s.name}</b><span>{level.name}</span></div><div className="xp-bar"><i style={{width:`${prog}%`}}/></div><small>{s.xp||0} XP · {s.pts||0} coins</small></div></div>})}</div></div><div className="panel"><PanelHead eyebrow="RECENT ACTIVITY" title="Coin transactions"/>{tx.length?<div className="transaction-list">{tx.map(t=>{const s=students.find(x=>x.id===t.studentId);return <div className="transaction-row" key={t.id}><div><b>{s?.name||'Student'}</b><span>{t.reason}</span></div><strong className={Number(t.amount)>=0?'positive':'negative'}>{Number(t.amount)>=0?'+':''}{t.amount} 🪙</strong></div>})}</div>:<Empty text="New coin transactions will appear here."/>}</div></section></div>;
}

function ShopPage({students,items,orders,allStudents,addShopItem,buyItem,setOrderStatus}) {
  const [name,setName]=useState(''); const [price,setPrice]=useState(300); const [stock,setStock]=useState(10);
  const [studentId,setStudentId]=useState(students[0]?.id||'');
  useEffect(()=>{if(students.length&&!students.some(s=>s.id===studentId))setStudentId(students[0].id)},[students,studentId]);
  return <div className="page-stack"><section className="panel shop-head"><div><span className="eyebrow">ARK SHOP</span><h2>Rewards marketplace</h2><p>Students spend ARK Coins; XP stays untouched.</p></div><div className="shop-add"><input value={name} onChange={e=>setName(e.target.value)} placeholder="New reward"/><input type="number" value={price} onChange={e=>setPrice(Number(e.target.value)||0)} placeholder="Coins"/><input type="number" value={stock} onChange={e=>setStock(Number(e.target.value)||0)} placeholder="Stock"/><button className="primary" onClick={()=>{addShopItem({name,price,stock});setName('')}}><Plus size={16}/>Add item</button></div></section><section className="panel"><div className="shop-buyer"><label><span>Buy for student</span><select value={studentId} onChange={e=>setStudentId(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.pts||0} coins</option>)}</select></label></div><div className="shop-grid">{items.filter(i=>i.active!==false).map(item=><div className="shop-card" key={item.id}><div className="shop-icon"><ShoppingBag size={22}/></div><h3>{item.name}</h3><b>{item.price} 🪙</b><span>{item.stock} in stock</span><button className="primary full" disabled={!studentId||item.stock<=0} onClick={()=>buyItem(studentId,item.id)}>Purchase</button></div>)}</div></section><section className="panel"><PanelHead eyebrow="ORDERS" title="Shop requests"/>{orders.length?<div className="order-list">{orders.slice(0,50).map(o=>{const s=allStudents.find(x=>x.id===o.studentId);const item=items.find(x=>x.id===o.itemId);return <div className="order-row" key={o.id}><div><b>{s?.name||'Student'} · {item?.name||'Reward'}</b><span>{o.price} coins · {new Date(o.createdAt).toLocaleDateString()}</span></div><select value={o.status} onChange={e=>setOrderStatus(o.id,e.target.value)}><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>})}</div>:<Empty text="No shop orders yet."/>}</section></div>;
}

function LeaderboardPage({students}) {
  const list=[...students].sort((a,b)=>Number(b.pts||0)-Number(a.pts||0));
  return <div className="page-stack"><section className="leader-hero"><div><span className="eyebrow">ARK RANKING</span><h2>Student leaderboard</h2><p>Current spendable ARK Coin balances.</p></div><Trophy size={38}/></section>{list.length?<><MiniPodium leaders={list.slice(0,3)}/><section className="panel"><div className="ranking-list">{list.map((s,i)=><LeaderRow key={s.id} student={s} rank={i+1}/>)}</div></section></>:<section className="panel"><Empty text="No students in this course."/></section>}</div>;
}

function BlackListPage({items}) {
  return <div className="page-stack"><section className="blacklist-hero"><div><span className="eyebrow">AUTOMATIC WATCH LIST</span><h2>Black list</h2><p>Two consecutive lesson days with incomplete homework triggers this list.</p></div><div className="blacklist-total"><AlertTriangle size={22}/><strong>{items.length}</strong><span>students</span></div></section><section className="panel">{items.length?<div className="blacklist-list">{items.map(({student,streak,days},i)=><div className="blacklist-row" key={student.id}><span className="rank-num">{i+1}</span><StudentCell student={student}/><div className="blacklist-days">{days.map(d=><span key={d}>{d}</span>)}</div><b>{streak} days</b></div>)}</div>:<Empty text="No students are currently on the black list."/>}</section></div>;
}

function Kpi({icon:Icon,label,value,hint,wide}) { return <div className={`kpi ${wide?'wide':''}`}><div className="kpi-icon"><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>; }
function PanelHead({eyebrow,title,action}) { return <div className="panel-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>; }
function Quick({icon:Icon,title,text,onClick}) { return <button className="quick-card" onClick={onClick}><div><Icon size={20}/></div><b>{title}</b><span>{text}</span></button>; }
function StudentCell({student}) { return <div className="student-cell"><div className="avatar">{student.name?.[0]?.toUpperCase()}</div><div><b>{student.name}</b><span>{student.group}</span></div></div>; }
function LeaderRow({student:s,rank}) { return <div className="leader-row"><span className={`rank r${rank}`}>{rank}</span><div className="avatar">{s.name?.[0]?.toUpperCase()}</div><div className="grow"><b>{s.name}</b><small>{s.group} · {levelFor(s.xp).name}</small></div><strong>{s.pts||0} <Coins size={14}/></strong></div>; }
function MiniPodium({leaders}) { const order=[leaders[1],leaders[0],leaders[2]].filter(Boolean); return <div className="mini-podium">{order.map((s,idx)=>{const rank=idx===0&&leaders[1]?2:idx===1?1:3;return <div className={`podium-card rank-${rank}`} key={s.id}><div className="podium-crown">{rank===1?<Crown size={19}/>:<Medal size={18}/>}</div><div className="podium-avatar">{s.name?.[0]?.toUpperCase()}</div><b>{s.name}</b><span>{s.group}</span><strong>{s.pts||0} 🪙</strong><small>#{rank}</small></div>})}</div>; }
function Empty({text}) { return <div className="empty"><Users size={28}/><b>Nothing here yet</b><span>{text}</span></div>; }

function AddStudentModal({state,courses,initialCourseId,onClose,onAdd}) {
  const [courseId,setCourseId]=useState(initialCourseId); const groups=visibleGroups(state,courseId);
  const [form,setForm]=useState({name:'',group:groups[0]||'',phone:'',parentName:'',parentPhone:'',monthlyFee:''});
  useEffect(()=>{const gs=visibleGroups(state,courseId);if(!gs.includes(form.group))setForm(p=>({...p,group:gs[0]||''}))},[courseId,state,form.group]);
  return <Modal onClose={onClose} eyebrow="NEW STUDENT" title="Add student"><div className="form-grid two"><label className="field"><span>Course</span><select value={courseId} onChange={e=>setCourseId(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>Group</span><select value={form.group} onChange={e=>setForm(p=>({...p,group:e.target.value}))}>{groups.map(g=><option key={g}>{g}</option>)}</select></label></div><label className="field"><span>Student name</span><input autoFocus value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Full name"/></label><div className="form-grid two"><label className="field"><span>Student phone</span><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="+998..."/></label><label className="field"><span>Monthly fee</span><input type="number" value={form.monthlyFee} onChange={e=>setForm(p=>({...p,monthlyFee:e.target.value}))} placeholder="0"/></label></div><div className="form-grid two"><label className="field"><span>Parent name</span><input value={form.parentName} onChange={e=>setForm(p=>({...p,parentName:e.target.value}))} placeholder="Parent / guardian"/></label><label className="field"><span>Parent phone</span><input value={form.parentPhone} onChange={e=>setForm(p=>({...p,parentPhone:e.target.value}))} placeholder="+998..."/></label></div><button className="primary full" disabled={!form.name.trim()||!form.group} onClick={()=>onAdd({...form,courseId})}><Save size={16}/>Save student</button></Modal>;
}

function AddGroupModal({courses,initialCourseId,onClose,onAdd}) { const [name,setName]=useState('');const [courseId,setCourseId]=useState(initialCourseId);return <Modal onClose={onClose} eyebrow="NEW GROUP" title="Add group"><label className="field"><span>Course</span><select value={courseId} onChange={e=>setCourseId(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>Group name</span><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. History A"/></label><button className="primary full" onClick={()=>onAdd(name,courseId)}><Save size={16}/>Save group</button></Modal>; }
function SimpleNameModal({eyebrow,title,placeholder,onClose,onAdd}) { const [name,setName]=useState('');return <Modal onClose={onClose} eyebrow={eyebrow} title={title}><label className="field"><span>Name</span><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder={placeholder}/></label><button className="primary full" onClick={()=>onAdd(name)}><Save size={16}/>Save</button></Modal>; }
function AddStaffModal({courses,initialCourseId,onClose,onAdd}) { const [name,setName]=useState('');const [phone,setPhone]=useState('');const [role,setRole]=useState('teacher');const [courseId,setCourseId]=useState(initialCourseId);return <Modal onClose={onClose} eyebrow="NEW STAFF" title="Add teacher / admin"><label className="field"><span>Full name</span><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label><div className="form-grid two"><label className="field"><span>Role</span><select value={role} onChange={e=>setRole(e.target.value)}><option value="teacher">Teacher</option><option value="admin">Admin</option></select></label><label className="field"><span>Course</span><select value={courseId} onChange={e=>setCourseId(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><label className="field"><span>Phone</span><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+998..."/></label><button className="primary full" onClick={()=>onAdd({name,phone,role,courseIds:[courseId]})}><Save size={16}/>Save staff</button></Modal>; }
function Modal({onClose,eyebrow,title,children}) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button onClick={onClose}><X size={18}/></button></div>{children}</div></div>; }
