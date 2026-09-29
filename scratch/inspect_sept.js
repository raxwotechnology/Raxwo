require('dotenv').config();
const mongoose = require('mongoose');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');
const FinanceEntry = require('../server/src/models/FinanceEntry');
const BankAccount = require('../server/src/models/BankAccount');

async function inspectSept() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');

  const subs = await Subscription.find().lean();
  console.log('=== Payments with paidAt in September 2026 ===');
  for (const s of subs) {
    for (const p of s.payments || []) {
      const d = new Date(p.paidAt);
      if (d.getFullYear() === 2026 && d.getMonth() === 8) {
        console.log(`Sub ${s.subscriptionNo} (${s.title}): Payment ${p._id}, Date: ${d.toISOString()}, Amt: ${p.amount}, Method: ${p.method}, Bank: ${p.bankAccount}, Note: ${p.note}`);
      }
      // Also check createdAt if available
      if (p.createdAt) {
        const cd = new Date(p.createdAt);
        if (cd.getFullYear() === 2026 && cd.getMonth() === 8) {
          console.log(`   [createdAt in Sept]: Sub ${s.subscriptionNo}, Date: ${cd.toISOString()}, paidAt: ${d.toISOString()}`);
        }
      }
    }
  }

  console.log('\n=== Subscriptions with nextDueDate in October or later ===');
  for (const s of subs) {
    const nd = new Date(s.nextDueDate);
    if (nd > new Date('2026-09-30T23:59:59.999Z')) {
      console.log(`Sub ${s.subscriptionNo} (${s.title}): NextDueDate = ${nd.toISOString().slice(0, 10)}, TotalBilled = ${s.totalBilled}, TotalPaid = ${s.totalPaid}`);
    }
  }

  console.log('\n=== All Finance Entries with Subscriptions in September 2026 ===');
  const fin = await FinanceEntry.find({
    date: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-30T23:59:59.999Z')
    },
    $or: [
      { category: { $regex: 'subscription', $options: 'i' } },
      { title: { $regex: 'subscription', $options: 'i' } }
    ]
  }).lean();
  for (const f of fin) {
    console.log(`Finance: ${f._id} | Date: ${f.date.toISOString().slice(0, 10)} | Title: ${f.title} | Amt: ${f.amount} | Bank: ${f.bankAccount}`);
  }

  const bank = await BankAccount.findOne();
  console.log('\n=== All Bank Transactions for subscriptions in September 2026 ===');
  const txs = (bank.transactions || []).filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === 2026 && d.getMonth() === 8 && (t.moduleSource === 'subscriptions' || /subscription/i.test(t.description));
  });
  for (const t of txs) {
    console.log(`TX: ${t._id} | Date: ${t.date.toISOString().slice(0, 10)} | Type: ${t.type} | Amt: ${t.amount} | Desc: ${t.description}`);
  }

  process.exit(0);
}

inspectSept().catch(e => { console.error(e); process.exit(1); });
