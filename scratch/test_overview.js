require('dotenv').config();
const mongoose = require('mongoose');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');

async function testOverview() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');

  const subs = await Subscription.find({
    status: { $in: ['active', 'overdue'] },
    client: { $ne: null }
  }).populate('client', 'name email').populate('project', 'title');

  // Month: 2026-09
  // Range: 2026-09-01 to 2026-09-30
  const rangeStart = new Date(2026, 8, 1, 0, 0, 0);
  const rangeEnd = new Date(2026, 9, 0, 23, 59, 59, 999);

  let totalMRR = 0;
  let totalOverdue = 0;
  let totalCollected = 0;
  let monthlyCollected = 0;
  let pendingPayments = 0;
  let overduePayments = 0;
  let overdueCount = 0;

  function calcOverdueDays(nextDueDate) {
    if (!nextDueDate) return 0;
    const now = new Date('2026-09-25T21:00:00.000Z');
    const dueEnd = new Date(nextDueDate);
    dueEnd.setHours(23, 59, 59, 999);
    if (now <= dueEnd) return 0;
    return Math.ceil((now - dueEnd) / 86400000);
  }

  const list = [];

  subs.forEach((s) => {
    let amount = s.amount || 0;
    let monthlyEquiv = amount;
    totalMRR += monthlyEquiv;

    let collectedInPeriod = 0;
    (s.payments || []).forEach((p) => {
      const pAmt = p.amount || 0;
      totalCollected += pAmt;
      if (p.paidAt) {
        const pd = new Date(p.paidAt);
        if (pd >= rangeStart && pd <= rangeEnd) {
          collectedInPeriod += pAmt;
          monthlyCollected += pAmt;
        }
      }
    });

    const overdue = calcOverdueDays(s.nextDueDate);
    const periodRemaining = Math.max(0, monthlyEquiv - collectedInPeriod);

    if (overdue > 0 && periodRemaining > 0) {
      totalOverdue += periodRemaining;
      overduePayments += periodRemaining;
      overdueCount++;
    } else if (periodRemaining > 0) {
      pendingPayments += periodRemaining;
    }

    const septStatus = overdue > 0 && periodRemaining > 0 ? 'overdue' : periodRemaining > 0 ? 'unpaid' : 'paid';
    
    // Also check overall sub status:
    const totalPaid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const overallRemaining = Math.max(0, (s.totalBilled || 0) - totalPaid);
    const overallStatus = (overdue > 0 && overallRemaining > 0) ? 'overdue' : overallRemaining > 0 ? 'unpaid' : 'paid';

    list.push({
      no: s.subscriptionNo,
      title: s.title,
      client: s.client?.name,
      amount: s.amount,
      nextDueDate: s.nextDueDate?.toISOString().slice(0, 10),
      totalBilled: s.totalBilled,
      totalPaid: totalPaid,
      overallRemaining,
      collectedInSept: collectedInPeriod,
      periodRemainingInSept: periodRemaining,
      septStatus,
      overallStatus,
      status: s.status,
    });
  });

  console.table(list);
  console.log({
    totalMRR,
    monthlyCollected,
    pendingPayments,
    overduePayments,
    overdueCount,
    totalCollected,
  });

  process.exit(0);
}

testOverview().catch(e => { console.error(e); process.exit(1); });
