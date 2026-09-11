'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CreditCard, ShoppingBag, UserCog, Users } from 'lucide-react';

const STATE_KEY = 'ark-tracker-v1';

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function debtCount(state, courseId) {
  const now = new Date();
  const todayKey = currentMonthKey();
  const day = now.getDate();
  const students = (state.students || []).filter(s => !s.archived && (courseId === 'all' || (s.courseId || state.groupMeta?.[s.group]?.courseId || 'english') === courseId));
  return students.filter(s => {
    const fee = Number(s.monthlyFee || 0);
    if (!fee) return false;
    const start = s.paymentStart || todayKey;
    const dueDay = Math.min(28, Math.max(1, Number(s.paymentDay || 5)));
    const payment = Number(state.payments?.[s.id]?.[todayKey]?.amount || 0);
    const started = todayKey >= start;
    return started && day > dueDay && payment < fee;
  }).length;
}

function goTo(label) {
  const buttons = [...document.querySelectorAll('.sidebar nav button')];
  const btn = buttons.find(b => (b.textContent || '').toLowerCase().includes(label.toLowerCase()));
  btn?.click();
}

export default function DashboardEnhancer() {
  const [mount, setMount] = useState(null);
  const [snapshot, setSnapshot] = useState({ pendingOrders: 0, unassigned: 0, overdue: 0, access: 0 });

  useEffect(() => {
    const refresh = () => {
      const title = document.querySelector('.top-title h1');
      const isDashboard = title?.textContent?.trim() === 'Dashboard';
      const stack = isDashboard ? document.querySelector('.content .page-stack') : null;
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
      const courseId = document.querySelector('.course-switcher select')?.value || 'english';
      const groups = [...new Set([...(state.groups || []), ...(state.students || []).map(s => s.group).filter(Boolean)])]
        .filter(g => courseId === 'all' || (state.groupMeta?.[g]?.courseId || 'english') === courseId);
      const unassigned = groups.filter(g => !state.groupMeta?.[g]?.teacherId).length;
      const pendingOrders = (state.shopOrders || []).filter(o => (o.status || 'pending') === 'pending').length;
      const access = Number(document.querySelector('.access-button b')?.textContent || 0);
      setSnapshot({ pendingOrders, unassigned, overdue: debtCount(state, courseId), access });

      const dashboardKpis = stack.querySelectorAll(':scope > .kpi-grid:first-child > .kpi');
      const staffLabel = dashboardKpis?.[2]?.querySelector('div:last-child > span');
      if (staffLabel && staffLabel.textContent !== 'Assigned staff') staffLabel.textContent = 'Assigned staff';

      stack.querySelectorAll('.group-mini > strong').forEach(el => {
        const match = (el.textContent || '').trim().match(/^(\d+)\/wk$/);
        if (!match) return;
        const n = Number(match[1]);
        el.textContent = n ? `${n} lesson${n === 1 ? '' : 's'}/wk` : 'No schedule';
      });

      let previousScore = null;
      let previousRank = 0;
      stack.querySelectorAll('.leader-list .leader-row').forEach((row, index) => {
        const score = Number((row.querySelector('strong')?.textContent || '').replace(/[^0-9.-]/g, ''));
        const rank = score === previousScore ? previousRank : index + 1;
        const rankEl = row.querySelector('.rank');
        if (rankEl) rankEl.textContent = String(rank);
        previousScore = score;
        previousRank = rank;
      });
    };

    refresh();
    const timer = setInterval(refresh, 900);
    return () => clearInterval(timer);
  }, []);

  const items = useMemo(() => [
    { key: 'staff', icon: UserCog, label: 'Unassigned groups', value: snapshot.unassigned, note: 'need a teacher', onClick: () => goTo('Groups') },
    { key: 'orders', icon: ShoppingBag, label: 'Shop orders', value: snapshot.pendingOrders, note: 'pending requests', onClick: () => goTo('Shop') },
    { key: 'payments', icon: CreditCard, label: 'Overdue payments', value: snapshot.overdue, note: 'this month', onClick: () => goTo('Finance') },
    { key: 'access', icon: Users, label: 'Access requests', value: snapshot.access, note: 'waiting approval', onClick: () => document.querySelector('.access-button')?.click() },
  ], [snapshot]);

  if (!mount) return null;
  return createPortal(
    <section className="panel dashboard-attention">
      <div className="dashboard-attention-head">
        <div><span className="eyebrow">NEEDS ATTENTION</span><h2>Pending items</h2></div>
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
