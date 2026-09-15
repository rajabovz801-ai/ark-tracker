import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCoinReward, applyXpReward } from '../app/rewardActions.mjs';

const baseState = {
  students: [{ id: 's1', name: 'Ali', pts: 20, xp: 100 }],
  coinTransactions: [],
  xpTransactions: [],
};

const idFactory = () => 'tx-1';
const now = '2026-09-15T09:00:00.000Z';

test('coin reward changes coin balance but not XP', () => {
  const next = applyCoinReward(baseState, 's1', 10, 'Teacher reward', { now, idFactory });
  assert.equal(next.students[0].pts, 30);
  assert.equal(next.students[0].xp, 100);
  assert.equal(next.coinTransactions[0].amount, 10);
});

test('negative coin adjustment cannot reduce balance below zero', () => {
  const next = applyCoinReward(baseState, 's1', -50, 'Adjustment', { now, idFactory });
  assert.equal(next.students[0].pts, 0);
  assert.equal(next.students[0].xp, 100);
  assert.equal(next.coinTransactions[0].amount, -20);
});

test('XP reward increases XP only and records XP activity', () => {
  const next = applyXpReward(baseState, 's1', 25, 'Excellent speaking', { now, idFactory });
  assert.equal(next.students[0].pts, 20);
  assert.equal(next.students[0].xp, 125);
  assert.equal(next.xpTransactions[0].amount, 25);
});

test('XP reward rejects zero and negative amounts', () => {
  assert.equal(applyXpReward(baseState, 's1', 0, 'Nope', { now, idFactory }), baseState);
  assert.equal(applyXpReward(baseState, 's1', -5, 'Nope', { now, idFactory }), baseState);
});
