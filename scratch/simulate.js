require('dotenv').config();
const mongoose = require('mongoose');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');
const FinanceEntry = require('../server/src/models/FinanceEntry');
const BankAccount = require('../server/src/models/BankAccount');

async function simulate() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');

  const subs = await Subscription.find().lean();
  console.log('=== BEFORE ===');
  console.log(`Total subs: ${subs.length}`);
  
  let totalBilledBefore = 0;
  let totalPaidBefore = 0;
  let septPaymentsBefore = 0;

  for (const s of subs) {
    totalBilledBefore += s.totalBilled || 0;
    totalPaidBefore += s.totalPaid || 0;
    for (const p of s.payments || []) {
      const d = new Date(p.paidAt);
      if (d.getFullYear() === 2026 && d.getMonth() === 8) {
        septPaymentsBefore += p.amount;
        console.log(`Sept payment found on ${s.subscriptionNo}: ${p.amount} on ${d.toISOString()}`);
      }
    }
  }
  console.log(`Total Billed: ${totalBilledBefore}, Total Paid: ${totalPaidBefore}, Sept Payments: ${septPaymentsBefore}`);

  const finSeptBefore = await FinanceEntry.find({
    date: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-30T23:59:59.999Z')
    },
    $or: [
      { category: { $regex: 'subscription', $options: 'i' } },
      { title: { $regex: 'subscription', $options: 'i' } }
    ]
  }).lean();
  console.log(`Sept Finance Sub Entries count: ${finSeptBefore.length}`);
  finSeptBefore.forEach(f => console.log(`  Finance Entry: ${f._id} | ${f.title} | ${f.amount}`));

  const bank = await BankAccount.findOne();
  console.log(`Bank Current Balance Before: ${bank.currentBalance}`);
  const septSubBankTxs = (bank.transactions || []).filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === 2026 && d.getMonth() === 8 && (t.moduleSource === 'subscriptions' || /subscription/i.test(t.description));
  });
  console.log(`Sept Sub Bank TXs count: ${septSubBankTxs.length}`);
  septSubBankTxs.forEach(t => console.log(`  TX: ${t._id} | ${t.description} | ${t.amount} | Date: ${t.date?.toISOString()?.slice(0, 10)}`));

  process.exit(0);
}

simulate().catch(e => { console.error(e); process.exit(1); });
