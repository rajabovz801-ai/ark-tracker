import assert from 'node:assert/strict';
import {
  continuousActivityDates,
  cumulativeDebt,
  currentPaymentState,
  dateRange,
  isActiveStudent,
  lifecycleStatus,
  paymentDueDay,
} from '../app/arkDomain.mjs';

const dates = dateRange('2026-09-25','2026-10-02');
assert.equal(dates.length,8,'dateRange must continue across months');
assert.equal(dates.at(-1),'2026-10-02','dateRange end must be inclusive');

const active = { id:'a', lifecycleStatus:'active', archived:false, monthlyFee:500000, paymentDay:5, paymentStart:'2026-08' };
const trial = { ...active, id:'t', lifecycleStatus:'trial' };
const left = { ...active, id:'l', lifecycleStatus:'left_active', archived:true };
assert.equal(isActiveStudent(active),true);
assert.equal(isActiveStudent(trial),false,'trial is not an active student KPI');
assert.equal(lifecycleStatus(left),'left_active');
assert.equal(paymentDueDay({ paymentDueDay:40 }),28,'due day must be clamped');

const state = {
  payments: {
    a: {
      '2026-08': { amount:500000 },
      '2026-09': { amount:200000 },
    }
  },
  records: {
    a: {
      '2026-09-07': { attendance:'present' },
      '2026-10-02': { attendance:'present' },
    }
  },
  taskLabels: {},
  lessonTopics: {},
};

const asOf = new Date('2026-09-12T12:00:00');
assert.equal(currentPaymentState(state,trial,asOf).key,'exempt','trial must never become debtor');
assert.equal(cumulativeDebt(state,trial,asOf),0,'trial debt must be zero');
assert.equal(cumulativeDebt(state,active,asOf),300000,'active cumulative debt must use payment start and paid amount');

const activity = continuousActivityDates(state,['a'],'2026-10-02');
assert.equal(activity[0],'2026-09-07');
assert.equal(activity.at(-1),'2026-10-02');
assert.ok(activity.length > 20,'results timeline must not stop at 20 days');

console.log('ARK domain regression tests passed');
