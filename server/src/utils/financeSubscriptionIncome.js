const mongoose = require('mongoose');
const FinanceEntry = require('../models/FinanceEntry');
const Subscription = require('../models/Subscription');

function paymentMethodKey(method = '') {
  return String(method || 'cash').toLowerCase().replace(/\s+/g, '_');
}

function mapSubscriptionPaymentMethod(method = '') {
  const map = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    card: 'Card',
    online: 'Online Payment',
    online_transfer: 'Online Payment',
    payhere: 'Online Payment',
    manual: 'Other',
  };
  return map[paymentMethodKey(method)] || 'Other';
}

function matchesPaymentMethodFilter(actualMethod, filterMethod) {
  if (!filterMethod) return true;
  return paymentMethodKey(actualMethod) === paymentMethodKey(filterMethod);
}

function isSubscriptionIncomeTitle(title = '') {
  return /^(new subscription|subscription payment):/i.test(String(title).trim());
}

function isSubscriptionIncomeEntry(entry) {
  if (!entry || entry.type !== 'income') return false;
  const cat = String(entry.category || '').trim();
  const title = String(entry.title || '').trim();
  return /^subscriptions?$/i.test(cat) || isSubscriptionIncomeTitle(title);
}

function sameCalendarDay(a, b) {
  if (!a || !b) return false;
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

async function aggregateSubscriptionPayments(branchId, dateFilter) {
  const pipeline = [];
  const match = {};
  if (branchId) {
    match.branch = new mongoose.Types.ObjectId(branchId);
  }
  if (dateFilter) {
    match['payments.paidAt'] = dateFilter;
  }
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }
  pipeline.push({ $unwind: '$payments' });
  if (dateFilter) {
    pipeline.push({ $match: { 'payments.paidAt': dateFilter } });
  }
  pipeline.push({
    $project: {
      _id: '$payments._id',
      subscriptionId: '$_id',
      amount: '$payments.amount',
      date: '$payments.paidAt',
      method: '$payments.method',
      title: '$title',
      subscriptionNo: '$subscriptionNo',
      note: '$payments.note',
      branch: '$branch',
    },
  });
  const payments = await Subscription.aggregate(pipeline);
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  return { payments, total, count: payments.length };
}


function normalizePaymentRow(p) {
  return {
    _id: p._id,
    type: 'income',
    category: 'Subscriptions',
    title: `Subscription Payment: ${p.title}`,
    amount: Number(p.amount || 0),
    date: p.date,
    paymentMethod: mapSubscriptionPaymentMethod(p.method),
    note: p.subscriptionNo || p.note || '',
    source: 'subscription',
  };
}

function normalizeFinanceRow(e) {
  return {
    _id: e._id,
    type: 'income',
    category: e.category || 'Subscriptions',
    title: e.title,
    amount: Number(e.amount || 0),
    date: e.date,
    paymentMethod: e.paymentMethod || 'Other',
    note: e.note || '',
    source: 'finance_entry',
    bankAccount: e.bankAccount,
    branch: e.branch,
    createdBy: e.createdBy,
  };
}

/**
 * Resolve subscription income for a period without double-counting finance rows + payment records.
 */
async function resolveSubscriptionIncome(branchId, dateFilter, paymentMethod) {
  const finQ = {
    type: 'income',
    $or: [
      { category: { $regex: /^subscriptions?$/i } },
      { title: { $regex: /^(new subscription|subscription payment):/i } },
    ],
  };
  if (branchId) finQ.branch = branchId;
  if (dateFilter) finQ.date = dateFilter;

  const [financeRows, agg] = await Promise.all([
    FinanceEntry.find(finQ).sort({ date: -1 }).lean(),
    aggregateSubscriptionPayments(branchId, dateFilter),
  ]);

  let financeEntries = financeRows
    .map(normalizeFinanceRow)
    .filter((e) => matchesPaymentMethodFilter(e.paymentMethod, paymentMethod));

  let paymentEntries = agg.payments
    .map(normalizePaymentRow)
    .filter((e) => matchesPaymentMethodFilter(e.paymentMethod, paymentMethod));

  const merged = [...financeEntries];
  for (const pe of paymentEntries) {
    const alreadyLogged = financeEntries.some(
      (fe) => Math.abs(fe.amount - pe.amount) < 0.01 && sameCalendarDay(fe.date, pe.date),
    );
    if (!alreadyLogged) merged.push(pe);
  }

  merged.sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = merged.reduce((s, e) => s + Number(e.amount || 0), 0);
  return { total, count: merged.length, entries: merged, financeCount: financeEntries.length, paymentCount: paymentEntries.length };
}

/**
 * Log subscription amount as financial income (finance entry + optional payment row on subscription).
 */
async function logSubscriptionIncome({
  sub,
  amount,
  date,
  createdBy,
  kind = 'payment',
  method = 'manual',
  note = '',
  reference = '',
  bankAccount = null,
  syncPayment = false,
}) {
  const amt = Number(amount || 0);
  if (!sub || amt <= 0 || !createdBy) return null;

  const incomeDate = date ? new Date(date) : new Date();
  if (Number.isNaN(incomeDate.getTime())) return null;
  incomeDate.setHours(12, 0, 0, 0);

  const titlePrefix = kind === 'created' ? 'New Subscription' : 'Subscription Payment';
  const entry = await FinanceEntry.create({
    type: 'income',
    category: 'Subscriptions',
    title: `${titlePrefix}: ${sub.title} (${sub.subscriptionNo || ''})`,
    amount: amt,
    date: incomeDate,
    note: note || `Sub No: ${sub.subscriptionNo || ''}${reference ? ` | Ref: ${reference}` : ''}`,
    paymentMethod: mapSubscriptionPaymentMethod(method),
    bankAccount: bankAccount || null,
    branch: sub.branch || null,
    createdBy,
  });

  if (syncPayment && typeof sub.payments?.push === 'function') {
    sub.payments.push({
      amount: amt,
      method: method || 'manual',
      reference: reference || '',
      note: note || (kind === 'created' ? 'Income on subscription setup' : ''),
      bankAccount: bankAccount || null,
      recordedBy: createdBy,
      paidAt: incomeDate,
    });
    sub.totalPaid = Number(sub.totalPaid || 0) + amt;
    await sub.save();
  }

  return entry;
}

/** Create missing FinanceEntry rows for subscription payments (legacy data repair). */
async function backfillSubscriptionFinanceEntries(createdBy) {
  if (!createdBy) throw new Error('createdBy user id required');

  const subs = await Subscription.find({})
    .select('title subscriptionNo branch amount startDate createdAt payments')
    .lean();

  let created = 0;
  let skipped = 0;

  const hasExistingIncome = async (sub, amount, paidAt) => {
    const dayStart = new Date(paidAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(paidAt);
    dayEnd.setHours(23, 59, 59, 999);
    const ref = String(sub.subscriptionNo || sub.title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return FinanceEntry.findOne({
      type: 'income',
      $or: [
        { category: { $regex: /^subscriptions?$/i } },
        { title: { $regex: /^(new subscription|subscription payment):/i } },
      ],
      amount: Number(amount || 0),
      date: { $gte: dayStart, $lte: dayEnd },
      title: { $regex: ref, $options: 'i' },
    }).select('_id');
  };

  for (const sub of subs) {
    if (!sub.payments?.length && Number(sub.amount) > 0) {
      const paidAt = sub.startDate ? new Date(sub.startDate) : new Date(sub.createdAt || Date.now());
      const existing = await hasExistingIncome(sub, sub.amount, paidAt);
      if (existing) {
        skipped += 1;
      } else {
        await FinanceEntry.create({
          type: 'income',
          category: 'Subscriptions',
          title: `New Subscription: ${sub.title} (${sub.subscriptionNo || ''})`,
          amount: Number(sub.amount),
          date: paidAt,
          note: `Sub No: ${sub.subscriptionNo || ''} | Backfilled on subscription setup`,
          paymentMethod: 'Other',
          branch: sub.branch || null,
          createdBy,
        });
        created += 1;
      }
      continue;
    }

    for (const payment of sub.payments || []) {
      const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
      const dayStart = new Date(paidAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(paidAt);
      dayEnd.setHours(23, 59, 59, 999);

      const existing = await hasExistingIncome(sub, payment.amount, paidAt);

      if (existing) {
        skipped += 1;
        continue;
      }

      await FinanceEntry.create({
        type: 'income',
        category: 'Subscriptions',
        title: `Subscription Payment: ${sub.title} (${sub.subscriptionNo || ''})`,
        amount: Number(payment.amount || 0),
        date: paidAt,
        note: `Sub No: ${sub.subscriptionNo || ''} | Backfilled from subscription payment`,
        paymentMethod: mapSubscriptionPaymentMethod(payment.method),
        bankAccount: payment.bankAccount || null,
        branch: sub.branch || null,
        createdBy,
      });
      created += 1;
    }
  }

  return { created, skipped, subscriptionsScanned: subs.length };
}

module.exports = {
  isSubscriptionIncomeEntry,
  isSubscriptionIncomeTitle,
  mapSubscriptionPaymentMethod,
  matchesPaymentMethodFilter,
  paymentMethodKey,
  aggregateSubscriptionPayments,
  resolveSubscriptionIncome,
  logSubscriptionIncome,
  backfillSubscriptionFinanceEntries,
};
