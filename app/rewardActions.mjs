function makeMeta(options = {}) {
  return {
    now: options.now || new Date().toISOString(),
    id: (options.idFactory || (() => crypto.randomUUID()))(),
  };
}

export function applyCoinReward(state, studentId, delta, reason = 'Manual reward', options = {}) {
  const amount = Number(delta || 0);
  if (!amount || !state || !Array.isArray(state.students)) return state;

  const student = state.students.find(item => item.id === studentId);
  if (!student) return state;

  const currentBalance = Number(student.pts || 0);
  const nextBalance = Math.max(0, currentBalance + amount);
  const appliedAmount = nextBalance - currentBalance;
  if (!appliedAmount) return state;

  const meta = makeMeta(options);
  return {
    ...state,
    students: state.students.map(item =>
      item.id === studentId ? { ...item, pts: nextBalance } : item
    ),
    coinTransactions: [
      {
        id: meta.id,
        studentId,
        amount: appliedAmount,
        reason: String(reason || 'Manual reward'),
        createdAt: meta.now,
      },
      ...(Array.isArray(state.coinTransactions) ? state.coinTransactions : []),
    ].slice(0, 1000),
  };
}

export function applyXpReward(state, studentId, value, reason = 'Teacher XP reward', options = {}) {
  const amount = Number(value || 0);
  if (amount <= 0 || !state || !Array.isArray(state.students)) return state;

  const student = state.students.find(item => item.id === studentId);
  if (!student) return state;

  const meta = makeMeta(options);
  return {
    ...state,
    students: state.students.map(item =>
      item.id === studentId
        ? { ...item, xp: Math.max(0, Number(item.xp || 0)) + amount }
        : item
    ),
    xpTransactions: [
      {
        id: meta.id,
        studentId,
        amount,
        reason: String(reason || 'Teacher XP reward'),
        createdAt: meta.now,
      },
      ...(Array.isArray(state.xpTransactions) ? state.xpTransactions : []),
    ].slice(0, 1000),
  };
}
