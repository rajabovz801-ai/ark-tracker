(() => {
  'use strict';

  const STATE_KEY = 'ark-tracker-v1';
  const CORE_GROUPS = ['IELTS', 'CEFR', '404'];
  const DAY_PLAN = [
    ['2026-09-07','7 Sep',false],['2026-09-08','8 Sep',false],['2026-09-09','9 Sep',false],
    ['2026-09-10','10 Sep',false],['2026-09-11','11 Sep',false],['2026-09-12','12 Sep',false],
    ['2026-09-13','13 Sep',true],['2026-09-14','14 Sep',false],['2026-09-15','15 Sep',false],
    ['2026-09-16','16 Sep',false],['2026-09-17','17 Sep',false],['2026-09-18','18 Sep',false],
    ['2026-09-19','19 Sep',false],['2026-09-20','20 Sep',true],['2026-09-21','21 Sep',false],
    ['2026-09-22','22 Sep',false],['2026-09-23','23 Sep',false],['2026-09-24','24 Sep',false],
    ['2026-09-25','25 Sep',false],['2026-09-26','26 Sep',false]
  ];
  const LABEL_TO_DATE = Object.fromEntries(DAY_PLAN.map(([date,label]) => [label, date]));

  let lastRaw = '';

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function writeState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function groupsOf(state) {
    const saved = Array.isArray(state.groups) ? state.groups : [];
    const studentGroups = (state.students || []).map(s => s.group).filter(Boolean);
    return [...new Set([...CORE_GROUPS, ...saved, ...studentGroups])];
  }

  function groupMetric(state, group) {
    const students = (state.students || []).filter(s => s.group === group);
    let done = 0;
    let possible = 0;
    let present = 0;
    let absent = 0;

    students.forEach(student => {
      DAY_PLAN.forEach(([date,,rest]) => {
        if (rest) return;
        const rec = state.records?.[student.id]?.[date] || {};
        if (rec.attendance === 'present') present++;
        if (rec.attendance === 'absent') absent++;
        const labels = state.taskLabels?.[group]?.[date] || {};
        Object.keys(labels).forEach(key => {
          if (!String(labels[key] || '').trim()) return;
          possible++;
          if (rec.modules?.[key]) done++;
        });
      });
    });

    return {
      group,
      students: students.length,
      done,
      possible,
      progress: possible ? Math.round((done / possible) * 100) : 0,
      present,
      absent
    };
  }

  function getMetrics(state) {
    return groupsOf(state).map(group => groupMetric(state, group));
  }

  function ensureStyles() {
    if (document.getElementById('ark-overall-tools-style')) return;
    const style = document.createElement('style');
    style.id = 'ark-overall-tools-style';
    style.textContent = `
      .overall-analysis{margin-bottom:16px;padding:20px;overflow:hidden}
      .overall-analysis-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}
      .overall-analysis-head h2{margin:5px 0 3px;font-size:22px;letter-spacing:-.025em}
      .overall-analysis-head p{margin:0;color:#8f949d;font-size:13px}
      .overall-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}
      .overall-summary-card{border:1px solid var(--line);background:#fafbfc;border-radius:13px;padding:15px 16px;min-height:90px}
      .overall-summary-card span,.overall-summary-card strong,.overall-summary-card small{display:block}
      .overall-summary-card span{font-size:11px;font-weight:800;color:#9297a0}
      .overall-summary-card strong{font-size:25px;line-height:1.1;margin:6px 0 5px;color:#202329;letter-spacing:-.025em}
      .overall-summary-card small{font-size:10px;color:#9ba0a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .overall-summary-card.best{background:var(--yellow-soft);border-color:#f0dd80}
      .overall-summary-card.best strong{font-size:19px;color:#8e7000}
      .overall-bars{border-top:1px solid #eceef1;padding-top:17px;display:grid;gap:13px}
      .overall-bar-row{display:grid;grid-template-columns:minmax(90px,150px) 1fr 62px;gap:13px;align-items:center}
      .overall-bar-name b,.overall-bar-name span{display:block}
      .overall-bar-name b{font-size:13px;color:#2b2e34}
      .overall-bar-name span{font-size:10px;color:#a0a5ad;margin-top:2px}
      .overall-bar-track{height:16px;border-radius:999px;background:#eef0f3;overflow:hidden;position:relative}
      .overall-bar-fill{height:100%;min-width:0;border-radius:999px;background:linear-gradient(90deg,#34b46f,#51c982);transition:width .3s ease}
      .overall-bar-row.best-row .overall-bar-fill{background:linear-gradient(90deg,#e3b900,#ffd21f)}
      .overall-bar-value{font-size:13px;font-weight:850;text-align:right;color:#353940}
      .overall-empty{padding:24px;text-align:center;color:#9da2aa;font-size:12px}
      .delete-group-btn{color:#b6495e!important;border-color:#f0d7dc!important;background:#fff!important}
      .delete-group-btn:hover{background:#fff4f6!important;border-color:#edc3cc!important}
      .delete-group-modal-note{margin:9px 0 0;padding:10px 11px;border-radius:9px;background:#fff5e7;color:#8a6324;font-size:10px;line-height:1.5}
      .delete-group-danger{background:#d9425f!important;border-color:#d9425f!important;color:#fff!important}
      .delete-group-danger:disabled{opacity:.45;cursor:not-allowed}
      .topic-focus-flash{animation:topicFocusFlash .85s ease}
      @keyframes topicFocusFlash{0%{box-shadow:0 0 0 0 rgba(255,210,31,.65)}45%{box-shadow:0 0 0 5px rgba(255,210,31,.24);border-color:#e1bc1e}100%{box-shadow:0 0 0 0 rgba(255,210,31,0)}}
      @media(max-width:1050px){.overall-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){.overall-summary-grid{grid-template-columns:1fr}.overall-bar-row{grid-template-columns:82px 1fr 48px}.overall-analysis{padding:15px}.overall-analysis-head h2{font-size:19px}}
    `;
    document.head.appendChild(style);
  }

  function renderOverallAnalysis() {
    const topbar = document.querySelector('.content > .topbar');
    const heading = topbar?.querySelector('h1')?.textContent?.trim() || '';
    let panel = document.querySelector('.overall-analysis');

    if (!topbar || heading !== 'Overall Dashboard') {
      panel?.remove();
      return;
    }

    const state = readState();
    const metrics = getMetrics(state);
    const totalStudents = (state.students || []).length;
    const activeGroups = metrics.filter(m => m.students > 0).length;
    const withHomework = metrics.filter(m => m.possible > 0);
    const best = withHomework.length
      ? [...withHomework].sort((a,b) => b.progress - a.progress || b.students - a.students)[0]
      : null;
    const totalDone = metrics.reduce((sum,m) => sum + m.done, 0);
    const totalPossible = metrics.reduce((sum,m) => sum + m.possible, 0);
    const overallProgress = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;

    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'panel overall-analysis';
      topbar.insertAdjacentElement('afterend', panel);
    }

    panel.innerHTML = `
      <div class="overall-analysis-head">
        <div>
          <span class="eyebrow">OVERALL ANALYSIS</span>
          <h2>All groups at a glance</h2>
          <p>Student count and homework performance across every group.</p>
        </div>
      </div>
      <div class="overall-summary-grid">
        <div class="overall-summary-card"><span>Total students</span><strong>${totalStudents}</strong><small>across all groups</small></div>
        <div class="overall-summary-card"><span>Active groups</span><strong>${activeGroups}</strong><small>${metrics.length} groups in tracker</small></div>
        <div class="overall-summary-card best"><span>Best group</span><strong>${best ? escapeHtml(best.group) : 'No data yet'}</strong><small>${best ? `${best.progress}% homework submitted` : 'assign homework to compare'}</small></div>
        <div class="overall-summary-card"><span>Overall submitted</span><strong>${overallProgress}%</strong><small>assigned tasks only</small></div>
      </div>
      <div class="overall-bars">
        ${metrics.length ? metrics.map(m => `
          <div class="overall-bar-row ${best && m.group === best.group ? 'best-row' : ''}">
            <div class="overall-bar-name"><b>${escapeHtml(m.group)}</b><span>${m.students} student${m.students === 1 ? '' : 's'}</span></div>
            <div class="overall-bar-track" title="${m.done}/${m.possible} submitted"><div class="overall-bar-fill" style="width:${Math.max(0, Math.min(100, m.progress))}%"></div></div>
            <div class="overall-bar-value">${m.possible ? `${m.progress}%` : '—'}</div>
          </div>
        `).join('') : '<div class="overall-empty">Add groups and students to see the analysis.</div>'}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function ensureDeleteButton() {
    const actions = document.querySelector('.top-actions');
    const addGroup = actions?.querySelector('.add-group-btn');
    if (!actions || !addGroup) return;
    if (actions.querySelector('.delete-group-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'view-all delete-group-btn';
    btn.type = 'button';
    btn.innerHTML = '<span style="font-size:17px;line-height:1">−</span> Delete group';
    btn.addEventListener('click', openDeleteGroupModal);
    addGroup.insertAdjacentElement('afterend', btn);
  }

  function openDeleteGroupModal() {
    document.querySelector('.delete-group-enhancement-modal')?.remove();
    const state = readState();
    const customGroups = groupsOf(state).filter(g => !CORE_GROUPS.includes(g));

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop delete-group-enhancement-modal';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div><span class="eyebrow">DELETE GROUP</span><h2>Remove a group</h2></div>
          <button type="button" class="delete-close">×</button>
        </div>
        ${customGroups.length ? `
          <label>Group
            <select class="delete-group-select">
              ${customGroups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
            </select>
          </label>
          <p class="delete-group-modal-note">Deleting a group also removes its students, attendance, homework records, topics and counters. IELTS, CEFR and 404 are protected core groups.</p>
          <button type="button" class="primary full delete-group-danger">Delete group</button>
        ` : `
          <p class="delete-group-modal-note">There are no custom groups to delete. IELTS, CEFR and 404 are protected core groups.</p>
          <button type="button" class="view-all full delete-close-secondary">Close</button>
        `}
      </div>
    `;

    const close = () => backdrop.remove();
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });
    backdrop.querySelector('.delete-close')?.addEventListener('click', close);
    backdrop.querySelector('.delete-close-secondary')?.addEventListener('click', close);
    backdrop.querySelector('.delete-group-danger')?.addEventListener('click', () => {
      const group = backdrop.querySelector('.delete-group-select')?.value;
      if (!group) return;
      const members = (state.students || []).filter(s => s.group === group);
      const message = members.length
        ? `Delete ${group} and its ${members.length} student${members.length === 1 ? '' : 's'}? This cannot be undone.`
        : `Delete ${group}? This cannot be undone.`;
      if (!window.confirm(message)) return;
      deleteGroup(group);
    });

    document.body.appendChild(backdrop);
  }

  function deleteGroup(group) {
    const state = readState();
    const removedIds = new Set((state.students || []).filter(s => s.group === group).map(s => s.id));
    const nextRecords = {};
    Object.entries(state.records || {}).forEach(([id, value]) => {
      if (!removedIds.has(id)) nextRecords[id] = value;
    });

    const taskLabels = { ...(state.taskLabels || {}) };
    const lessonTopics = { ...(state.lessonTopics || {}) };
    const liveLessons = { ...(state.liveLessons || {}) };
    delete taskLabels[group];
    delete lessonTopics[group];
    delete liveLessons[group];

    const next = {
      ...state,
      groups: (Array.isArray(state.groups) ? state.groups : CORE_GROUPS).filter(g => g !== group),
      students: (state.students || []).filter(s => s.group !== group),
      records: nextRecords,
      taskLabels,
      lessonTopics,
      liveLessons
    };

    writeState(next);
    window.location.reload();
  }

  function enableCalendarTopicFocus() {
    document.querySelectorAll('.calendar-grid button:not(.rest)').forEach(btn => {
      if (btn.dataset.topicFocusBound === '1') return;
      btn.dataset.topicFocusBound = '1';
      btn.addEventListener('click', () => {
        setTimeout(() => {
          const input = document.querySelector('.topic-field input');
          if (!input) return;
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          input.focus({ preventScroll: true });
          input.classList.remove('topic-focus-flash');
          void input.offsetWidth;
          input.classList.add('topic-focus-flash');
        }, 80);
      });
    });
  }

  function refresh(force = false) {
    ensureStyles();
    ensureDeleteButton();
    enableCalendarTopicFocus();
    const raw = localStorage.getItem(STATE_KEY) || '';
    const heading = document.querySelector('.content > .topbar h1')?.textContent?.trim() || '';
    if (force || raw !== lastRaw || heading === 'Overall Dashboard') {
      lastRaw = raw;
      renderOverallAnalysis();
    }
  }

  const observer = new MutationObserver(() => refresh(false));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => refresh(true));
  setInterval(() => refresh(false), 700);
  refresh(true);
})();
