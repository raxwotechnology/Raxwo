require('dotenv').config();
const mongoose = require('mongoose');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');
const FinanceEntry = require('../server/src/models/FinanceEntry');
const BankAccount = require('../server/src/models/BankAccount');
const Invoice = require('../server/src/models/Invoice');

async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');
  const subs = await Subscription.find().populate('client', 'name email');
  console.log('Total subscriptions:', subs.length);
  
  for (const s of subs) {
    console.log('--------------------------------------------------');
    console.log(`Sub ID: ${s._id} | No: ${s.subscriptionNo} | Title: ${s.title}`);
    console.log(`Client: ${s.client?.name} | Amount: ${s.amount} | Frequency: ${s.billingFrequency} | Status: ${s.status}`);
    console.log(`StartDate: ${s.startDate} | NextDueDate: ${s.nextDueDate} | TotalBilled: ${s.totalBilled} | TotalPaid: ${s.totalPaid}`);
    console.log(`Payments count: ${s.payments?.length}`);
    (s.payments || []).forEach((p, idx) => {
      console.log(`  [Payment ${idx+1}] ID: ${p._id} | Amt: ${p.amount} | Date: ${p.paidAt?.toISOString()} | Method: ${p.method} | Bank: ${p.bankAccount} | Ref: ${p.reference} | Note: ${p.note}`);
    });
  }

  // Check finance entries
  const finSubEntries = await FinanceEntry.find({
    $or: [
      { category: { $regex: 'subscription', $options: 'i' } },
      { title: { $regex: 'subscription', $options: 'i' } }
    ]
  }).sort({ date: -1 });

  console.log(`\n================ Finance Entries count: ${finSubEntries.length} ================`);
  finSubEntries.forEach(f => {
    console.log(`Finance ID: ${f._id} | Title: ${f.title} | Amt: ${f.amount} | Date: ${f.date?.toISOString()} | Method: ${f.paymentMethod} | Bank: ${f.bankAccount}`);
  });

  // Check bank accounts
  const banks = await BankAccount.find();
  console.log(`\n================ Bank Accounts count: ${banks.length} ================`);
  banks.forEach(b => {
    console.log(`Bank: ${b.bankName} (${b.accountNumber}) | Balance: ${b.currentBalance} | TX count: ${b.transactions?.length}`);
    const septTx = (b.transactions || []).filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === 8; // September is 8
    });
    console.log(`  September TXs: ${septTx.length}`);
    septTx.forEach(t => {
      console.log(`    TX ID: ${t._id} | Type: ${t.type} | Amt: ${t.amount} | Date: ${t.date?.toISOString()} | Desc: ${t.description} | Module: ${t.moduleSource}`);
    });
  });

  // Check Invoices related to subscriptions
  const invs = await Invoice.find({
    $or: [
      { serviceType: 'Subscription' },
      { source: 'subscription' },
      { subscriptionRef: { $ne: null } }
    ]
  });
  console.log(`\n================ Subscription Invoices count: ${invs.length} ================`);
  invs.forEach(inv => {
    console.log(`Invoice: ${inv.invoiceNo} | Date: ${inv.invoiceDate?.toISOString()} | Subtotal: ${inv.subtotal} | Status: ${inv.status} | SubRef: ${inv.subscriptionRef}`);
  });

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
