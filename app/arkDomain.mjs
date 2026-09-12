export function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function courseOf(state, student) {
  return student?.courseId || state?.groupMeta?.[student?.group]?.courseId || 'english';
}

export function lifecycleStatus(student) {
  if (student?.lifecycleStatus) return student.lifecycleStatus;
  return student?.archived ? 'left_active' : 'active';
}

export function isActiveStudent(student) {
  return !student?.archived && lifecycleStatus(student) === 'active';
}

export function isLearningStudent(student) {
  const status = lifecycleStatus(student);
  return !student?.archived && (status === 'active' || status === 'trial');
}

export function paymentDueDay(student) {
  return Math.max(1, Math.min(28, Number(student?.paymentDueDay || student?.paymentDay || 5)));
}

export function paymentStartMonth(student, fallbackDate = new Date()) {
  return student?.paymentStart || monthKey(fallbackDate);
}

export function currentPaymentState(state, student, now = new Date()) {
  const status = lifecycleStatus(student);
  const fee = Math.max(0, Number(student?.monthlyFee || 0));
  const key = monthKey(now);
  const paid = Math.max(0, Number(state?.payments?.[student?.id]?.[key]?.amount || 0));
  const dueDay = paymentDueDay(student);
  const start = paymentStartMonth(student, now);
  const started = key >= start;

  if (status !== 'active') return { key: 'exempt', label: status === 'trial' ? 'Sinov davri' : 'Faol emas', paid, fee, dueDay, start, debt: 0 };
  if (!started) return { key: 'not_started', label: 'To‘lov boshlanmagan', paid, fee, dueDay, start, debt: 0 };
  if (fee <= 0) return { key: 'none', label: 'To‘lov belgilanmagan', paid, fee, dueDay, start, debt: 0 };
  if (paid >= fee) return { key: 'paid', label: 'To‘langan', paid, fee, dueDay, start, debt: 0 };

  const overdue = now.getDate() > dueDay;
  const debt = Math.max(0, fee - paid);
  if (overdue) return { key: 'overdue', label: paid > 0 ? 'Qisman · kechikkan' : 'Qarzdor', paid, fee, dueDay, start, debt };
  return { key: paid > 0 ? 'partial' : 'pending', label: paid > 0 ? 'Qisman' : 'Kutilmoqda', paid, fee, dueDay, start, debt: 0 };
}

export function cumulativeDebt(state, student, now = new Date()) {
  if (!isActiveStudent(student)) return 0;
  const fee = Math.max(0, Number(student?.monthlyFee || 0));
  if (!fee) return 0;
  const start = paymentStartMonth(student, now);
  const [startYear, startMonth] = start.split('-').map(Number);
  if (!startYear || !startMonth) return 0;
  const currentKey = monthKey(now);
  const dueDay = paymentDueDay(student);
  let debt = 0;

  for (let year = startYear; year <= now.getFullYear(); year++) {
    const from = year === startYear ? startMonth : 1;
    const to = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let month = from; month <= to; month++) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const due = key < currentKey || (key === currentKey && now.getDate() > dueDay);
      if (!due) continue;
      const paid = Math.max(0, Number(state?.payments?.[student?.id]?.[key]?.amount || 0));
      debt += Math.max(0, fee - paid);
    }
  }
  return debt;
}

export function dateRange(startISO, endISO) {
  if (!startISO || !endISO || startISO > endISO) return [];
  const out = [];
  const cursor = new Date(`${startISO}T12:00:00`);
  const end = new Date(`${endISO}T12:00:00`);
  while (cursor <= end) {
    out.push(localISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function activityDates(state, studentIds = null, until = localISODate()) {
  const ids = studentIds ? new Set(studentIds) : null;
  const set = new Set();

  Object.entries(state?.records || {}).forEach(([studentId, byDate]) => {
    if (ids && !ids.has(studentId)) return;
    Object.keys(byDate || {}).forEach(date => { if (date <= until) set.add(date); });
  });
  Object.values(state?.taskLabels || {}).forEach(byDate => Object.keys(byDate || {}).forEach(date => { if (date <= until) set.add(date); }));
  Object.values(state?.lessonTopics || {}).forEach(byDate => Object.keys(byDate || {}).forEach(date => { if (date <= until) set.add(date); }));
  set.add(until);
  return [...set].sort();
}

export function continuousActivityDates(state, studentIds = null, until = localISODate()) {
  const dates = activityDates(state, studentIds, until);
  const first = dates[0] || until;
  return dateRange(first, until);
}

export function dayMeta(date) {
  const d = new Date(`${date}T12:00:00`);
  const weekdays = ['Yak','Du','Se','Ch','Pa','Ju','Sha'];
  const months = ['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek'];
  return {
    date,
    day: weekdays[d.getDay()],
    label: `${d.getDate()} ${months[d.getMonth()]}`,
    sunday: d.getDay() === 0,
  };
}

export function isRestDate(state, date, groups = []) {
  const hasTask = groups.some(group => Object.values(state?.taskLabels?.[group]?.[date] || {}).some(v => String(v || '').trim()));
  const hasTopic = groups.some(group => String(state?.lessonTopics?.[group]?.[date] || '').trim());
  return !hasTask && !hasTopic && dayMeta(date).sunday;
}

export function levelForXp(xp) {
  const n = Number(xp || 0);
  if (n >= 5000) return { name: 'Diamond', next: 5000 };
  if (n >= 3000) return { name: 'Gold', next: 5000 };
  if (n >= 1500) return { name: 'Silver', next: 3000 };
  if (n >= 500) return { name: 'Bronze', next: 1500 };
  return { name: 'Starter', next: 500 };
}
