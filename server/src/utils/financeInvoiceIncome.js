const mongoose = require('mongoose');
const FinanceEntry = require('../models/FinanceEntry');
const Invoice = require('../models/Invoice');

function mapInvoicePaymentMethod(method = '') {
  const { mapToFinancePaymentMethod } = require('./paymentMethods');
  return mapToFinancePaymentMethod(method);
}

function isInvoiceIncomeEntry(entry) {
  if (!entry || entry.type !== 'income') return false;
  const cat = String(entry.category || '').trim();
  const title = String(entry.title || '').trim();
  return /^invoice(s)?$/i.test(cat) || /^invoice (payment|advance):/i.test(title);
}

function sameCalendarDay(a, b) {
  if (!a || !b) return false;
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

async function aggregateInvoicePayments(branchId, dateFilter) {
  const match = { status: { $nin: ['cancelled', 'draft'] } };
  if (branchId) {
    match.branch = new mongoose.Types.ObjectId(branchId);
  }
  if (dateFilter) {
    match['payments.date'] = dateFilter;
  }
  const pipeline = [{ $match: match }];
  pipeline.push({ $unwind: '$payments' });
  if (dateFilter) {
    pipeline.push({ $match: { 'payments.date': dateFilter } });
  }
  pipeline.push({
    $project: {
      _id: '$payments._id',
      invoiceId: '$_id',
      amount: '$payments.amount',
      date: '$payments.date',
      method: '$payments.method',
      isAdvance: '$payments.isAdvance',
      invoiceNo: '$invoiceNo',
      note: '$payments.notes',
      branch: '$branch',
    },
  });
  const payments = await Invoice.aggregate(pipeline);
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  return { payments, total, count: payments.length };
}


function normalizePaymentRow(p) {
  const kind = p.isAdvance ? 'Advance' : 'Payment';
  return {
    _id: p._id,
    type: 'income',
    category: 'Invoices',
    title: `Invoice ${kind}: ${p.invoiceNo || ''}`,
    amount: Number(p.amount || 0),
    date: p.date,
    paymentMethod: mapInvoicePaymentMethod(p.method),
    note: p.note || p.invoiceNo || '',
    source: 'invoice',
  };
}

function normalizeFinanceRow(e) {
  return {
    _id: e._id,
    type: 'income',
    category: e.category || 'Invoices',
    title: e.title,
    amount: Number(e.amount || 0),
    date: e.date,
    paymentMethod: e.paymentMethod || 'Other',
    note: e.note || '',
    source: 'finance_entry',
    branch: e.branch,
    bankAccount: e.bankAccount,
  };
}

async function resolveInvoicePaymentIncome(branchId, dateFilter, paymentMethod) {
  const finQ = {
    type: 'income',
    $or: [
      { category: { $regex: /^invoices?$/i } },
      { title: { $regex: /^invoice (payment|advance):/i } },
    ],
  };
  if (branchId) finQ.branch = branchId;
  if (dateFilter) finQ.date = dateFilter;

  const [financeRows, agg] = await Promise.all([
    FinanceEntry.find(finQ).sort({ date: -1 }).lean(),
    aggregateInvoicePayments(branchId, dateFilter),
  ]);

  const financeEntries = financeRows
    .map(normalizeFinanceRow)
    .filter((e) => !paymentMethod || e.paymentMethod === paymentMethod || mapInvoicePaymentMethod(paymentMethod) === e.paymentMethod);

  const paymentEntries = agg.payments
    .map(normalizePaymentRow)
    .filter((pe) => !paymentMethod || pe.paymentMethod === paymentMethod || mapInvoicePaymentMethod(paymentMethod) === pe.paymentMethod);

  const merged = [...financeEntries];
  for (const pe of paymentEntries) {
    const alreadyLogged = financeEntries.some(
      (fe) => Math.abs(fe.amount - pe.amount) < 0.01 && sameCalendarDay(fe.date, pe.date),
    );
    if (!alreadyLogged) merged.push(pe);
  }

  merged.sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = merged.reduce((s, e) => s + Number(e.amount || 0), 0);
  return { total, count: merged.length, entries: merged };
}

async function logInvoicePaymentIncome({ invoice, amount, date, createdBy, isAdvance = false, method = 'cash', reference = '', notes = '', bankAccount = null }) {
  const amt = Number(amount || 0);
  if (!invoice || amt <= 0 || !createdBy) return null;

  const paymentDate = date ? new Date(date) : new Date();
  paymentDate.setHours(12, 0, 0, 0);
  const kind = isAdvance ? 'Advance' : 'Payment';

  return FinanceEntry.create({
    type: 'income',
    category: 'Invoices',
    title: `Invoice ${kind}: ${invoice.invoiceNo || ''}`,
    amount: amt,
    date: paymentDate,
    note: `Inv: ${invoice.invoiceNo || ''} | Ref: ${reference || '—'}${notes ? ` | ${notes}` : ''}`,
    paymentMethod: mapInvoicePaymentMethod(method),
    bankAccount: bankAccount || null,
    branch: invoice.branch || null,
    createdBy,
  });
}

async function backfillInvoiceFinanceEntries(createdBy) {
  const invoices = await Invoice.find({ 'payments.0': { $exists: true }, status: { $ne: 'cancelled' } })
    .select('invoiceNo branch payments')
    .lean();
  let created = 0;
  let skipped = 0;

  for (const inv of invoices) {
    for (const p of inv.payments || []) {
      const paidAt = p.date ? new Date(p.date) : new Date();
      const dayStart = new Date(paidAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(paidAt);
      dayEnd.setHours(23, 59, 59, 999);
      const kind = p.isAdvance ? 'Advance' : 'Payment';
      const existing = await FinanceEntry.findOne({
        type: 'income',
        title: { $regex: `Invoice ${kind}: ${inv.invoiceNo}`, $options: 'i' },
        amount: Number(p.amount || 0),
        date: { $gte: dayStart, $lte: dayEnd },
      }).select('_id');
      if (existing) {
        skipped += 1;
        continue;
      }
      await FinanceEntry.create({
        type: 'income',
        category: 'Invoices',
        title: `Invoice ${kind}: ${inv.invoiceNo || ''}`,
        amount: Number(p.amount || 0),
        date: paidAt,
        note: `Backfilled | Inv: ${inv.invoiceNo || ''}`,
        paymentMethod: mapInvoicePaymentMethod(p.method),
        branch: inv.branch || null,
        createdBy,
      });
      created += 1;
    }
  }
  return { created, skipped, invoicesScanned: invoices.length };
}

async function deleteInvoiceFinanceEntries(invoiceNo) {
  if (!invoiceNo) return;
  await FinanceEntry.deleteMany({
    type: 'income',
    category: 'Invoices',
    title: { $in: [`Invoice Payment: ${invoiceNo}`, `Invoice Advance: ${invoiceNo}`] }
  });
}

module.exports = {
  isInvoiceIncomeEntry,
  mapInvoicePaymentMethod,
  aggregateInvoicePayments,
  resolveInvoicePaymentIncome,
  logInvoicePaymentIncome,
  backfillInvoiceFinanceEntries,
  deleteInvoiceFinanceEntries,
};
