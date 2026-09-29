require('dotenv').config();
const mongoose = require('mongoose');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');
const FinanceEntry = require('../server/src/models/FinanceEntry');
const BankAccount = require('../server/src/models/BankAccount');

async function inspectSetup() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');

  const subs = await Subscription.find({
    subscriptionNo: { $in: ['SUB-2026-0016', 'SUB-2026-0017', 'SUB-2026-0018', 'SUB-2026-0019', 'SUB-2026-0020', 'SUB-2026-0021'] }
  }).lean();

  for (const s of subs) {
    console.log(`Sub: ${s.subscriptionNo} (${s.title}) | Created: ${s.createdAt} | Start: ${s.startDate} | NextDue: ${s.nextDueDate}`);
    console.log(`  Amount: ${s.amount} | Billed: ${s.totalBilled} | Paid: ${s.totalPaid}`);
    for (const p of s.payments || []) {
      console.log(`    Payment: ${p._id} | paidAt: ${p.paidAt} | createdAt: ${p.createdAt} | amt: ${p.amount} | note: ${p.note}`);
    }
  }

  // Check finance entries created on or around 2026-09-03
  const fin = await FinanceEntry.find({
    $or: [
      { createdAt: { $gte: new Date('2026-09-01'), $lte: new Date('2026-09-05') } },
      { date: { $gte: new Date('2026-08-30'), $lte: new Date('2026-09-05') } }
    ]
  }).lean();
  console.log('\nFinance entries around Sept 1-5:');
  for (const f of fin) {
    console.log(`  Finance: ${f._id} | date: ${f.date?.toISOString()?.slice(0, 10)} | created: ${f.createdAt?.toISOString()?.slice(0, 10)} | title: ${f.title} | amt: ${f.amount} | cat: ${f.category}`);
  }

  process.exit(0);
}

inspectSetup().catch(e => { console.error(e); process.exit(1); });
