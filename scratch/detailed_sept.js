require('dotenv').config();
const mongoose = require('mongoose');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');
const FinanceEntry = require('../server/src/models/FinanceEntry');
const BankAccount = require('../server/src/models/BankAccount');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');

  const subs = await Subscription.find().populate('client', 'name email').lean();
  console.log('=== ALL SUBSCRIPTIONS ===');
  for (const s of subs) {
    const septPayments = (s.payments || []).filter(p => {
      const d = new Date(p.paidAt);
      return d.getFullYear() === 2026 && d.getMonth() === 8; // September is 8
    });
    console.log(`ID: ${s._id} | No: ${s.subscriptionNo} | Title: ${s.title} | Amount: ${s.amount} | Status: ${s.status}`);
    console.log(`   Start: ${s.startDate?.toISOString()?.slice(0,10)} | NextDue: ${s.nextDueDate?.toISOString()?.slice(0,10)} | Billed: ${s.totalBilled} | Paid: ${s.totalPaid}`);
    console.log(`   Payments total: ${s.payments?.length || 0}, in Sept: ${septPayments.length}`);
    for (const p of s.payments || []) {
      console.log(`     Payment: ID ${p._id} | Date: ${new Date(p.paidAt).toISOString().slice(0,10)} | Amt: ${p.amount} | Method: ${p.method} | Bank: ${p.bankAccount} | Ref: ${p.reference} | Note: ${p.note}`);
    }
  }

  const septFinance = await FinanceEntry.find({
    date: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-30T23:59:59.999Z')
    }
  }).sort({ date: 1 }).lean();

  console.log('\n=== SEPTEMBER 2026 FINANCE ENTRIES (ALL) ===');
  for (const f of septFinance) {
    console.log(`ID: ${f._id} | Type: ${f.type} | Cat: ${f.category} | Title: ${f.title} | Amt: ${f.amount} | Date: ${f.date?.toISOString()?.slice(0,10)} | Method: ${f.paymentMethod} | Bank: ${f.bankAccount}`);
  }

  const bank = await BankAccount.findOne();
  console.log('\n=== BANK ACCOUNT ===');
  console.log(`Bank: ${bank.bankName} | Current Balance: ${bank.currentBalance}`);
  const septTxs = (bank.transactions || []).filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === 2026 && d.getMonth() === 8;
  });
  console.log(`Sept Bank Txs count: ${septTxs.length}`);
  for (const t of septTxs) {
    console.log(`TX ID: ${t._id} | Type: ${t.type} | Amt: ${t.amount} | Date: ${t.date?.toISOString()?.slice(0,10)} | Desc: ${t.description} | Module: ${t.moduleSource}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
