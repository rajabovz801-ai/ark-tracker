'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CreditCard, ShoppingBag, UserCog, Users } from 'lucide-react';
import { courseOf, cumulativeDebt, isActiveStudent, monthKey } from './arkDomain.mjs';

const STATE_KEY = 'ark-tracker-v1';
const COURSE_KEY = 'ark-tracker-last-course';
const TASK_KEYS = ['speaking','writing','reading','listening'];

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function activeStudentsFor(state, courseId) {
  return (state.students || []).filter(student => isActiveStudent(student) && (courseId === 'all' || courseOf(state, student) === courseId));
}

function courseGroups(state, courseId) {
  const deleted = new Set(Array.isArray(state.deletedGroups) ? state.deletedGroups : []);
  const saved = Array.isArray(state.groups) ? state.groups : [];
  const fromStudents = (state.students || []).map(student => student.group).filter(Boolean);
  return [...new Set([...saved, ...fromStudents])]
    .filter(group => !deleted.has(group))
    .filter(group => courseId === 'all' || (state.groupMeta?.[group]?.courseId || 'english') === courseId);
}

function taskScore(value) {
  if (value === true || value === 'done') return 1;
  if (value === 'partial') return .5;
  return 0;
}

function progressMetrics(state, students) {
  let present = 0;
  let absent = 0;
  let score = 0;
  let possible = 0;
  students.forEach(student => {
    const byDate = state.records?.[student.id] || {};
    Object.entries(byDate).forEach(([date, record]) => {
      if (record?.attendance === 'present') present++;
      if (record?.attendance === 'absent') absent++;
      TASK_KEYS.forEach(key => {
        const assigned = String(state.taskLabels?.[student.group]?.[date]?.[key] || '').trim();
        if (!assigned) return;
        possible++;
        score += taskScore(record?.modules?.[key]);
      });
    });
  });
  return {
    attendance: present + absent ? Math.round((present / (present + absent)) * 100) : 0,
    homework: possible ? Math.round((score / possible) * 100) : 0,
  };
}

function goTo(pageKey) {
  const button = document.querySelector(`.sidebar nav button[data-page-key="${pageKey}"]`);
  button?.click();
}

export default function DashboardEnhancer() {
  const [mount, setMount] = useState(null);
  const [snapshot, setSnapshot] = useState({ pendingOrders: 0, unassigned: 0, overdue: 0, access: 0 });

  useEffect(() => {
    const refresh = () => {
      const shell = document.querySelector('.app-shell');
      const isDashboard = shell?.dataset?.pageKey === 'Dashboard';
      const stack = isDashboard ? shell?.querySelector('.content .page-stack') : null;
      if (!stack) { setMount(null); return; }

      let target = document.getElementById('ark-dashboard-insights-mount');
      if (!target) {
        target = document.createElement('div');
        target.id = 'ark-dashboard-insights-mount';
        const quick = stack.querySelector('.quick-links');
        quick ? stack.insertBefore(target, quick) : stack.appendChild(target);
      }
      setMount(target);

      const state = readState();
      const profile = window.__ARK_AUTH_PROFILE__;
      const forcedTeacherCourse = profile?.role === 'teacher' && profile.course_ids?.length ? profile.course_ids[0] : '';
      const courseId = forcedTeacherCourse || localStorage.getItem(COURSE_KEY) || document.querySelector('.course-switcher select')?.value || 'english';
      const students = activeStudentsFor(state, courseId);
      const studentIds = new Set(students.map(student => student.id));
      const groups = courseGroups(state, courseId);
      const unassigned = groups.filter(group => !state.groupMeta?.[group]?.teacherId).length;
      const pendingOrders = (state.shopOrders || []).filter(order => (order.status || 'pending') === 'pending' && (!order.studentId || studentIds.has(order.studentId))).length;
      const access = Number(document.querySelector('.access-button b')?.textContent || 0);
      const overdue = students.filter(student => cumulativeDebt(state, student) > 0).length;
      setSnapshot({ pendingOrders, unassigned, overdue, access });

      const kpis = stack.querySelectorAll(':scope > .kpi-grid:first-child > .kpi');
      const metrics = progressMetrics(state, students);
      const staffCount = (state.staff || []).filter(staff => staff.active !== false && (courseId === 'all' || (staff.courseIds || []).includes(courseId))).length;
      const currentMonth = monthKey();
      const collected = students.reduce((sum, student) => sum + Number(state.payments?.[student.id]?.[currentMonth]?.amount || 0), 0);
      const coins = students.reduce((sum, student) => sum + Number(student.pts || 0), 0);

      const setKpi = (index, label, value, hint) => {
        const card = kpis[index];
        if (!card) return;
        const copy = card.querySelector('div:last-child');
        const labelEl = copy?.querySelector('span');
        const valueEl = copy?.querySelector('strong');
        const hintEl = copy?.querySelector('small');
        if (labelEl && label) labelEl.textContent = label;
        if (valueEl && value !== undefined) valueEl.textContent = String(value);
        if (hintEl && hint) hintEl.textContent = hint;
      };

      setKpi(0, 'Faol o‘quvchilar', students.length, courseId === 'all' ? 'barcha kurslar' : 'joriy kurs');
      setKpi(1, 'Guruhlar', groups.length, 'faol guruhlar');
      setKpi(2, 'Biriktirilgan xodimlar', staffCount, 'joriy kurs');
      setKpi(3, 'Davomat', `${metrics.attendance}%`, 'barcha belgilangan darslar');
      setKpi(4, 'Uy vazifasi', `${metrics.homework}%`, 'barcha topshiriqlar');
      setKpi(5, 'ARK Coin', coins.toLocaleString(), 'faol o‘quvchilar balansi');
      setKpi(6, 'Shu oy', `${collected.toLocaleString()} UZS`, 'yig‘ilgan to‘lovlar');

      stack.querySelectorAll('.group-mini > strong').forEach(element => {
        const match = (element.textContent || '').trim().match(/^(\d+)\/wk$/);
        if (!match) return;
        const count = Number(match[1]);
        element.textContent = count ? `Haftasiga ${count}` : 'Jadval yo‘q';
      });

      let previousScore = null;
      let previousRank = 0;
      stack.querySelectorAll('.leader-list .leader-row').forEach((row, index) => {
        const score = Number((row.querySelector('strong')?.textContent || '').replace(/[^0-9.-]/g, ''));
        const rank = score === previousScore ? previousRank : index + 1;
        const rankElement = row.querySelector('.rank');
        if (rankElement) rankElement.textContent = String(rank);
        previousScore = score;
        previousRank = rank;
      });
    };

    refresh();
    const timer = setInterval(refresh, 900);
    const onChange = () => refresh();
    window.addEventListener('ark-course-changed', onChange);
    window.addEventListener('ark-tracker-state-updated', onChange);
    window.addEventListener('ark-page-changed', onChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener('ark-course-changed', onChange);
      window.removeEventListener('ark-tracker-state-updated', onChange);
      window.removeEventListener('ark-page-changed', onChange);
    };
  }, []);

  const items = useMemo(() => [
    { key: 'staff', icon: UserCog, label: 'Biriktirilmagan guruhlar', value: snapshot.unassigned, note: 'o‘qituvchi kerak', onClick: () => goTo('Groups') },
    { key: 'orders', icon: ShoppingBag, label: 'Do‘kon buyurtmalari', value: snapshot.pendingOrders, note: 'kutilayotgan so‘rovlar', onClick: () => goTo('Shop') },
    { key: 'payments', icon: CreditCard, label: 'Kechikkan to‘lovlar', value: snapshot.overdue, note: 'joriy qarzdorlar', onClick: () => goTo('Finance') },
    { key: 'access', icon: Users, label: 'Kirish so‘rovlari', value: snapshot.access, note: 'tasdiqlash kutilmoqda', onClick: () => document.querySelector('.access-button')?.click() },
  ], [snapshot]);

  if (!mount) return null;
  return createPortal(
    <section className="panel dashboard-attention">
      <div className="dashboard-attention-head">
        <div><span className="eyebrow">E’TIBOR KERAK</span><h2>Kutilayotgan ishlar</h2></div>
        <AlertTriangle size={20}/>
      </div>
      <div className="attention-grid">
        {items.map(({ key, icon: Icon, label, value, note, onClick }) => (
          <button key={key} className={Number(value) > 0 ? 'attention-card has-items' : 'attention-card'} onClick={onClick}>
            <span className="attention-icon"><Icon size={17}/></span>
            <span className="attention-copy"><b>{label}</b><small>{note}</small></span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
    </section>,
    mount
  );
}
