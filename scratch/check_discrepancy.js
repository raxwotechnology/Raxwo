require('dotenv').config();
const mongoose = require('mongoose');
require('../server/src/models/User');
require('../server/src/models/Project');
const FinanceEntry = require('../server/src/models/FinanceEntry');
const BankAccount = require('../server/src/models/BankAccount');

async function checkSeptDiscrepancy() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');

  const bank = await BankAccount.findOne();
  console.log(`Bank Current Balance: ${bank.currentBalance}`);

  const septBankTxs = (bank.transactions || []).filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === 2026 && d.getMonth() === 8;
  });

  console.log('\n--- Sept Bank Transactions ---');
  let bankIn = 0, bankOut = 0;
  for (const t of septBankTxs) {
    if (t.type === 'deposit') bankIn += t.amount;
    else bankOut += t.amount;
    console.log(`[${t.type}] amt: ${t.amount} | date: ${t.date?.toISOString()?.slice(0, 10)} | desc: ${t.description} | mod: ${t.moduleSource}`);
  }
  console.log(`Total Bank In: ${bankIn}, Total Bank Out: ${bankOut}, Net: ${bankIn - bankOut}`);

  const septFin = await FinanceEntry.find({
    date: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-30T23:59:59.999Z')
    }
  }).sort({ date: 1 });

  console.log('\n--- Sept Finance Entries ---');
  let finIncome = 0, finExpense = 0;
  for (const f of septFin) {
    if (f.type === 'income') finIncome += f.amount;
    else finExpense += f.amount;
    console.log(`[${f.type}] amt: ${f.amount} | date: ${f.date?.toISOString()?.slice(0, 10)} | title: ${f.title} | method: ${f.paymentMethod} | bank: ${f.bankAccount ? 'Linked' : 'null'}`);
  }
  console.log(`Total Finance Income: ${finIncome}, Total Finance Expense: ${finExpense}, Net: ${finIncome - finExpense}`);

  process.exit(0);
}

checkSeptDiscrepancy().catch(e => { console.error(e); process.exit(1); });
