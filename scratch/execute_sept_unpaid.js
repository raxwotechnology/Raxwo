require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');
const FinanceEntry = require('../server/src/models/FinanceEntry');
const BankAccount = require('../server/src/models/BankAccount');

function calcOverdueDays(nextDueDate) {
  if (!nextDueDate) return 0;
  const now = new Date();
  const dueEnd = new Date(nextDueDate);
  dueEnd.setHours(23, 59, 59, 999);
  if (now <= dueEnd) return 0;
  return Math.ceil((now - dueEnd) / 86400000);
}

async function execute() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');
  console.log('Connected to MongoDB.');

  // 1. BACKUP
  const allSubs = await Subscription.find().lean();
  const allFin = await FinanceEntry.find().lean();
  const allBanks = await BankAccount.find().lean();
  fs.writeFileSync('scratch/backup_before_sept_unpaid.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    subscriptions: allSubs,
    financeEntries: allFin,
    bankAccounts: allBanks,
  }, null, 2));
  console.log('Backup saved to scratch/backup_before_sept_unpaid.json');

  // 2. PROCESS SUB-2026-0021
  const sub21 = await Subscription.findOne({ subscriptionNo: 'SUB-2026-0021' });
  if (sub21) {
    console.log('\n--- Updating SUB-2026-0021 ---');
    console.log(`Before: nextDueDate=${sub21.nextDueDate?.toISOString()}, totalBilled=${sub21.totalBilled}, totalPaid=${sub21.totalPaid}, paymentsCount=${sub21.payments?.length}`);
    
    // Find payment with paidAt in September 2026
    const septPaymentIndex = sub21.payments.findIndex(p => {
      const d = new Date(p.paidAt);
      return d.getFullYear() === 2026 && d.getMonth() === 8;
    });

    if (septPaymentIndex !== -1) {
      const removedPayment = sub21.payments[septPaymentIndex];
      console.log(`Removing September payment: ID ${removedPayment._id}, Amount: ${removedPayment.amount}, paidAt: ${removedPayment.paidAt}`);
      sub21.payments.splice(septPaymentIndex, 1);
      
      sub21.totalPaid = sub21.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      sub21.totalBilled = 20000; // 10000 setup + 10000 September
      
      // Revert nextDueDate to 2026-09-15
      const revDue = new Date('2026-09-15T12:00:00.000Z');
      sub21.nextDueDate = revDue;
      sub21.overdueDays = calcOverdueDays(revDue);
      sub21.status = sub21.overdueDays > 0 ? 'overdue' : 'active';
      
      await sub21.save();
      console.log(`After SUB-2026-0021: nextDueDate=${sub21.nextDueDate?.toISOString()}, totalBilled=${sub21.totalBilled}, totalPaid=${sub21.totalPaid}, remaining=${sub21.totalBilled - sub21.totalPaid}, status=${sub21.status}, overdueDays=${sub21.overdueDays}`);
    } else {
      console.log('No September payment found on SUB-2026-0021.');
    }
  }

  // 3. DELETE FINANCE ENTRY FOR SUB-2026-0021 IN SEPTEMBER
  console.log('\n--- Removing Finance Entry for SUB-2026-0021 in September ---');
  const finDelRes = await FinanceEntry.deleteMany({
    date: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-30T23:59:59.999Z')
    },
    $or: [
      { category: { $regex: 'subscription', $options: 'i' } },
      { title: { $regex: 'SUB-2026-0021', $options: 'i' } }
    ]
  });
  console.log(`Deleted ${finDelRes.deletedCount} finance entry(s).`);

  // 4. UPDATE BANK ACCOUNT TRANSACTIONS AND BALANCE
  console.log('\n--- Updating Bank Account ---');
  const bank = await BankAccount.findOne();
  if (bank) {
    console.log(`Initial Bank Balance: ${bank.currentBalance}`);
    
    // Find transaction for SUB-2026-0021 payment on 2026-09-15
    const septPaymentTxIndex = (bank.transactions || []).findIndex(t => {
      const d = new Date(t.date);
      return d.getFullYear() === 2026 && d.getMonth() === 8 && /Subscription Payment.*SUB-2026-0021/i.test(t.description);
    });

    if (septPaymentTxIndex !== -1) {
      const tx = bank.transactions[septPaymentTxIndex];
      console.log(`Removing Bank TX: ID ${tx._id}, Desc: ${tx.description}, Amount: ${tx.amount}`);
      bank.currentBalance -= tx.amount; // reverse deposit
      bank.transactions.splice(septPaymentTxIndex, 1);
    }

    // Align dates of the 6 setup transactions created on 2026-09-03 to 2026-08-31
    let alignedCount = 0;
    for (const t of bank.transactions) {
      const d = new Date(t.date);
      if (d.getFullYear() === 2026 && d.getMonth() === 8 && /Subscription Setup/i.test(t.description)) {
        t.date = new Date('2026-08-31T12:00:00.000Z');
        alignedCount++;
      }
    }
    console.log(`Aligned ${alignedCount} setup bank transactions to 2026-08-31.`);
    console.log(`New Bank Balance: ${bank.currentBalance}`);
    await bank.save();
  }

  // 5. UPDATE ALL OTHER SUBSCRIPTIONS TO BE UNPAID FOR SEPTEMBER
  console.log('\n--- Updating All Subscriptions to be UNPAID for September ---');
  const subs = await Subscription.find({
    status: { $in: ['active', 'overdue'] },
    subscriptionNo: { $ne: 'SUB-2026-0021' }
  });

  const now = new Date();
  for (const s of subs) {
    const totalPaid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const amount = s.amount || 0;
    
    // If nextDueDate is in September (or August), ensure totalBilled includes September
    const due = new Date(s.nextDueDate || now);
    if (due.getFullYear() === 2026 && due.getMonth() === 8) {
      // It's due in September!
      // If totalBilled <= totalPaid, increase totalBilled by amount so remaining = amount (unpaid)
      if (s.totalBilled <= totalPaid) {
        s.totalBilled = totalPaid + amount;
      }
      s.totalPaid = totalPaid;
      
      const dueEnd = new Date(due);
      dueEnd.setHours(23, 59, 59, 999);
      if (now > dueEnd) {
        s.overdueDays = calcOverdueDays(due);
        s.status = 'overdue';
      } else {
        s.overdueDays = 0;
        s.status = 'active';
      }
      await s.save();
      console.log(`Sub ${s.subscriptionNo}: Amount=${amount}, Billed=${s.totalBilled}, Paid=${s.totalPaid}, Remaining=${s.totalBilled - s.totalPaid}, Status=${s.status}, DueDate=${due.toISOString().slice(0, 10)}`);
    }
  }

  console.log('\n=== COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

execute().catch(e => { console.error('Error executing script:', e); process.exit(1); });
