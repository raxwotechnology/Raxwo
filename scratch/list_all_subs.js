require('dotenv').config();
const mongoose = require('mongoose');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');

async function listAll() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');
  const subs = await Subscription.find().populate('client', 'name email').sort({ subscriptionNo: 1 }).lean();

  console.log('Total subscriptions:', subs.length);
  for (const s of subs) {
    const totalPaid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const remaining = Math.max(0, (s.totalBilled || 0) - totalPaid);
    console.log(`Sub: ${s.subscriptionNo} | Title: "${s.title}" | Client: ${s.client?.name}`);
    console.log(`  Amount: ${s.amount} | Billed: ${s.totalBilled} | Paid: ${s.totalPaid} (actual payments sum: ${totalPaid}) | Remaining: ${remaining} | Status: ${s.status}`);
    console.log(`  Start: ${s.startDate?.toISOString().slice(0, 10)} | NextDueDate: ${s.nextDueDate?.toISOString().slice(0, 10)} | BillingDay: ${s.billingDay}`);
    console.log(`  Payments count: ${s.payments?.length}`);
    for (const p of s.payments || []) {
      console.log(`    - ID: ${p._id} | Date: ${new Date(p.paidAt).toISOString().slice(0, 10)} | Amt: ${p.amount} | Method: ${p.method} | Note: ${p.note}`);
    }
  }
  process.exit(0);
}

listAll().catch(e => { console.error(e); process.exit(1); });
