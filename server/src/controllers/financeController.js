const XLSX = require('xlsx');
const puppeteer = require('puppeteer');
const FinanceEntry = require('../models/FinanceEntry');
const Invoice = require('../models/Invoice');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Project = require('../models/Project');
const PettyCash = require('../models/PettyCash');
const Cheque = require('../models/Cheque');
const Quotation = require('../models/Quotation');
const ClientProfile = require('../models/ClientProfile');
const User = require('../models/User');
const { createAuditLog } = require('./auditController');
const { verifyActionPassword } = require('../utils/actionPassword');
const { isFinanceBankMethod, appendBankTransaction } = require('../utils/bankLedger');
const {
  isSubscriptionIncomeEntry,
  resolveSubscriptionIncome,
  backfillSubscriptionFinanceEntries,
} = require('../utils/financeSubscriptionIncome');
const {
  isInvoiceIncomeEntry,
  resolveInvoicePaymentIncome,
  backfillInvoiceFinanceEntries,
} = require('../utils/financeInvoiceIncome');
const { resolveChequeTransactions } = require('../utils/financeChequeIncome');
const {
  resolveAdvanceExpenses,
  resolveLoanTransactions,
  resolveBankLedgerTransactions,
} = require('../utils/financeEmployeeLedger');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Cash received from invoice payments in range (excludes draft/cancelled). */
async function aggregateInvoicePaymentRevenue(branchMatch, range) {
  const match = { ...branchMatch, status: { $nin: ['cancelled', 'draft'] } };
  if (range) match['payments.date'] = range;
  const rows = await Invoice.aggregate([
    { $match: match },
    { $unwind: '$payments' },
    { $match: { 'payments.date': range } },
    { $group: { _id: null, total: { $sum: '$payments.amount' }, paymentCount: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, paymentCount: rows[0]?.paymentCount || 0 };
}

async function aggregateInvoicePaymentRevenueByMonth(branchMatch, yearStart, yearEnd) {
  return Invoice.aggregate([
    { $match: { ...branchMatch, status: { $nin: ['cancelled', 'draft'] }, 'payments.date': { $gte: yearStart, $lte: yearEnd } } },
    { $unwind: '$payments' },
    { $match: { 'payments.date': { $gte: yearStart, $lte: yearEnd } } },
    { $group: { _id: { $month: '$payments.date' }, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
}


function financeEntrySnapshot(e) {
  if (!e) return null;
  return {
    type: e.type,
    category: e.category,
    title: e.title,
    amount: e.amount,
    date: e.date,
    note: e.note,
    paymentMethod: e.paymentMethod,
    branch: e.branch ? String(e.branch) : null,
    bankAccount: e.bankAccount ? String(e.bankAccount) : null,
  };
}

function getRange(month, year) {
  if (!month || !year) return {};
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
  return { $gte: start, $lte: end };
}

async function getEmpIds(branchId) {
  if (!branchId) return null;
  const emps = await Employee.find({ branch: branchId }).select('_id');
  return emps.map(e => e._id);
}

function parseLocalDateStart(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseLocalDateEnd(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function buildDateFilter({ from, to, month, year } = {}) {
  if (from || to) {
    const dateFilter = {};
    if (from) dateFilter.$gte = parseLocalDateStart(from);
    if (to) dateFilter.$lte = parseLocalDateEnd(to);
    return Object.keys(dateFilter).length ? dateFilter : null;
  }
  const range = getRange(month, year);
  return range.$gte ? range : null;
}

function paymentMethodKey(method = '') {
  return String(method || 'cash').toLowerCase().replace(/\s+/g, '_');
}

function mapPettyCashPaymentMethod(paymentType = '') {
  const map = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    card: 'Card',
    cheque: 'Cheque',
  };
  return map[paymentMethodKey(paymentType)] || 'Cash';
}

function matchesPaymentMethodFilter(actualMethod, filterMethod) {
  if (!filterMethod) return true;
  return paymentMethodKey(actualMethod) === paymentMethodKey(filterMethod);
}

function normalizePettyCashEntries(pettyCash = [], { type, paymentMethod } = {}) {
  return pettyCash
    .filter((p) => !type || (type === 'income' && p.type === 'in') || (type === 'expense' && p.type === 'out'))
    .filter((p) => matchesPaymentMethodFilter(mapPettyCashPaymentMethod(p.paymentType), paymentMethod))
    .map((p) => ({
      _id: p._id,
      type: p.type === 'in' ? 'income' : 'expense',
      category: p.type === 'in' ? 'Petty Cash (In)' : 'Petty Cash',
      title: `Petty Cash: ${p.description}`,
      amount: Number(p.amount || 0),
      date: p.date,
      paymentMethod: mapPettyCashPaymentMethod(p.paymentType),
      note: p.paidTo || '',
      source: 'petty_cash',
    }));
}

exports.addEntry = async (req, res, next) => {
  try {
    const { type, category, title, amount, date, note, branch, paymentMethod } = req.body;
    const data = {
      type,
      category,
      title,
      amount: Number(amount || 0),
      date: date ? new Date(date) : new Date(),
      note: note || '',
      paymentMethod: paymentMethod || 'Cash',
      bankAccount: req.body.bankAccount || null,
      createdBy: req.user._id,
      branch: branch || null,
    };
    if (req.file) {
      data.billFile = req.file.filename.startsWith('data:') ? req.file.filename : `/uploads/bills/${req.file.filename}`;
      data.billFileName = req.file.originalname;
    }
    const entry = await FinanceEntry.create(data);

    if (data.bankAccount && isFinanceBankMethod(data.paymentMethod)) {
      const isCredit = type === 'income';
      await appendBankTransaction(data.bankAccount, {
        type: isCredit ? 'deposit' : 'withdrawal',
        amount: data.amount,
        description: `Finance Entry: ${title} (${category})`,
        date: data.date,
        recordedBy: req.user._id,
        moduleSource: 'finance',
      });
    }

    await createAuditLog({
      user: req.user,
      action: 'create',
      module: 'financial',
      entityId: String(entry._id),
      entityName: entry.title,
      description: `Finance entry created: ${entry.title} (${entry.type}, LKR ${entry.amount})`,
      changes: { before: null, after: financeEntrySnapshot(entry.toObject ? entry.toObject() : entry) },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.status(201).json({ success: true, entry });
  } catch (err) { next(err); }
};

exports.updateEntry = async (req, res, next) => {
  try {
    const entry = await FinanceEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });

    const beforeSnap = financeEntrySnapshot(entry.toObject ? entry.toObject() : entry);

    if (entry.bankAccount && isFinanceBankMethod(entry.paymentMethod)) {
      const wasCredit = entry.type === 'income';
      await appendBankTransaction(entry.bankAccount, {
        type: wasCredit ? 'withdrawal' : 'deposit',
        amount: entry.amount,
        description: `Finance Reversal (Edit): ${entry.title}`,
        date: new Date(),
        recordedBy: req.user._id,
        moduleSource: 'finance',
      });
    }

    const { type, category, title, amount, date, note, branch, paymentMethod, bankAccount } = req.body;
    entry.type = type || entry.type;
    entry.category = category || entry.category;
    entry.title = title || entry.title;
    entry.amount = amount !== undefined ? Number(amount) : entry.amount;
    if (date) entry.date = new Date(date);
    entry.note = note !== undefined ? note : entry.note;
    entry.branch = branch || null;
    entry.paymentMethod = paymentMethod || entry.paymentMethod;
    entry.bankAccount = bankAccount || null;

    if (req.file) {
      entry.billFile = req.file.filename.startsWith('data:') ? req.file.filename : `/uploads/bills/${req.file.filename}`;
      entry.billFileName = req.file.originalname;
    }

    await entry.save();

    if (entry.bankAccount && isFinanceBankMethod(entry.paymentMethod)) {
      const isCredit = entry.type === 'income';
      await appendBankTransaction(entry.bankAccount, {
        type: isCredit ? 'deposit' : 'withdrawal',
        amount: entry.amount,
        description: `Finance Entry (Edited): ${entry.title}`,
        date: entry.date,
        recordedBy: req.user._id,
        moduleSource: 'finance',
      });
    }

    const afterSnap = financeEntrySnapshot(entry.toObject ? entry.toObject() : entry);
    await createAuditLog({
      user: req.user,
      action: 'update',
      module: 'financial',
      entityId: String(entry._id),
      entityName: entry.title,
      description: `Finance entry updated: ${entry.title} (${entry.type}, LKR ${entry.amount})`,
      changes: { before: beforeSnap, after: afterSnap },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({ success: true, entry });
  } catch (err) { next(err); }
};

exports.deleteEntry = async (req, res, next) => {
  try {
    const pw = req.body?.password ?? req.query?.password;
    const check = await verifyActionPassword(req.user._id, pw);
    if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });

    const entry = await FinanceEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });

    const beforeSnap = financeEntrySnapshot(entry.toObject ? entry.toObject() : entry);

    if (entry.bankAccount && isFinanceBankMethod(entry.paymentMethod)) {
      const wasCredit = entry.type === 'income';
      await appendBankTransaction(entry.bankAccount, {
        type: wasCredit ? 'withdrawal' : 'deposit',
        amount: entry.amount,
        description: `Finance Reversal (Deleted): ${entry.title}`,
        date: new Date(),
        recordedBy: req.user._id,
        moduleSource: 'finance',
      });
    }

    await entry.deleteOne();

    await createAuditLog({
      user: req.user,
      action: 'delete',
      module: 'financial',
      entityId: String(entry._id),
      entityName: beforeSnap.title,
      description: `Finance entry deleted: ${beforeSnap.title} (${beforeSnap.type}, LKR ${beforeSnap.amount})`,
      changes: { before: beforeSnap, after: null },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
      severity: 'warning',
    });

    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.getEntries = async (req, res, next) => {
  try {
    const { type, category, month, year, from, to, branch, paymentMethod } = req.query;
    const q = {};
    if (type) q.type = type;
    if (category) q.category = category;
    if (branch) q.branch = branch;
    if (paymentMethod) q.paymentMethod = paymentMethod;

    const dateFilter = buildDateFilter({ from, to, month, year });
    if (dateFilter) q.date = dateFilter;

    const pcQ = {};
    if (branch) pcQ.branch = branch;
    if (dateFilter) pcQ.date = dateFilter;

    const [rawEntries, pettyCash, subIncome, invIncome, chequeTx, advanceExp, loanTx] = await Promise.all([
      FinanceEntry.find(q)
        .sort({ date: -1, createdAt: -1 })
        .populate('createdBy', 'name email')
        .populate('bankAccount', 'bankName accountNumber')
        .populate('branch', 'name')
        .lean(),
      PettyCash.find(pcQ).sort({ date: -1 }).lean(),
      resolveSubscriptionIncome(branch, dateFilter, paymentMethod),
      resolveInvoicePaymentIncome(branch, dateFilter, paymentMethod),
      resolveChequeTransactions(branch, dateFilter, paymentMethod),
      resolveAdvanceExpenses(branch, dateFilter, paymentMethod),
      resolveLoanTransactions(branch, dateFilter, paymentMethod),
    ]);

    const entries = rawEntries
      .filter((e) => !isSubscriptionIncomeEntry(e) && !isInvoiceIncomeEntry(e));


    const pcEntries = normalizePettyCashEntries(pettyCash, { type, paymentMethod });
    const subEntries = type === 'expense' ? [] : subIncome.entries;
    const invEntries = type === 'expense' ? [] : invIncome.entries;
    const chequeIncome = type === 'expense' ? [] : chequeTx.incomeEntries;
    const chequeExpense = type === 'income' ? [] : chequeTx.expenseEntries;
    const advanceEntries = type === 'income' ? [] : advanceExp.entries;
    const loanDisbursements = type === 'income' ? [] : loanTx.expenseEntries;
    const loanRepayments = type === 'expense' ? [] : loanTx.incomeEntries;

    let allEntriesRaw = [
      ...entries, ...pcEntries, ...subEntries, ...invEntries,
      ...chequeIncome, ...chequeExpense,
      ...advanceEntries, ...loanDisbursements, ...loanRepayments,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let allEntries = [];
    const seenAll = new Set();
    for (const e of allEntriesRaw) {
      const key = String(e._id);
      if (!seenAll.has(key)) {
        seenAll.add(key);
        allEntries.push(e);
      }
    }

    if (category) {
      allEntries = allEntries.filter((e) => e.category === category);
    }

    const totals = allEntries.reduce((acc, e) => {
      if (e.countsInTotals === false) return acc;
      if (e.type === 'income') acc.income += Number(e.amount || 0);
      if (e.type === 'expense') acc.expense += Number(e.amount || 0);
      return acc;
    }, { income: 0, expense: 0 });
    totals.profit = totals.income - totals.expense;

    const categories = [...new Set(allEntries.map((e) => e.category).filter(Boolean))];
    res.json({ success: true, count: allEntries.length, entries: allEntries, totals, categories });
  } catch (err) { next(err); }
};

exports.getOverview = async (req, res, next) => {
  try {
    const { branch, from, to } = req.query;
    const now = new Date();
    
    let range;
    let yearForChart;
    if (from && to) {
      range = { $gte: parseLocalDateStart(from), $lte: parseLocalDateEnd(to) };
      yearForChart = parseLocalDateStart(from).getFullYear();
    } else {
      const month = Number(req.query.month || (now.getMonth() + 1));
      const year = Number(req.query.year || now.getFullYear());
      range = getRange(month, year);
      yearForChart = year;
    }

    const yearStart = new Date(yearForChart, 0, 1);
    const yearEnd = new Date(yearForChart, 11, 31, 23, 59, 59, 999);

    const branchMatch = branch ? { branch } : {};
    const empIds = await getEmpIds(branch);
    const empMatch = empIds ? { employee: { $in: empIds } } : {};

    const [paidInvoices, paidPayrolls, rawEntries, revenueByMonth, paymentRevenueAgg, incomeExpenseByCategory, pettyCashEntries, subIncome, invIncome, chequeTx, advanceExp, loanTx, bankLedger, cashAgg] = await Promise.all([
      Invoice.find({ ...branchMatch, status: 'paid', paidAt: range }).select('invoiceNo total paidAt client project').populate('client', 'name email').populate('project', 'title'),
      Payroll.find({ ...empMatch, status: 'paid', paidAt: range }).select('netSalary month year'),
      FinanceEntry.find({ ...branchMatch, date: range })
        .sort({ date: -1 })
        .populate('bankAccount', 'bankName accountNumber')
        .populate('branch', 'name'),
      aggregateInvoicePaymentRevenueByMonth(branchMatch, yearStart, yearEnd),
      aggregateInvoicePaymentRevenue(branchMatch, range),
      FinanceEntry.aggregate([
        { $match: { ...branchMatch, date: range } },
        { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
      PettyCash.find({ ...(branch ? { branch } : {}), date: range }).sort({ date: -1 }),
      resolveSubscriptionIncome(branch, range),
      resolveInvoicePaymentIncome(branch, range),
      resolveChequeTransactions(branch, range),
      resolveAdvanceExpenses(branch, range),
      resolveLoanTransactions(branch, range),
      resolveBankLedgerTransactions(branch, range),
      FinanceEntry.aggregate([
        { $match: { ...branchMatch, paymentMethod: 'cash', date: { $lte: range.$lte || new Date() } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ])
    ]);

    const entries = rawEntries.filter((e) => !isSubscriptionIncomeEntry(e) && !isInvoiceIncomeEntry(e));
    const pettyCashIn = pettyCashEntries.filter(p => p.type === 'in').reduce((s, p) => s + Number(p.amount || 0), 0);
    const pettyCashOut = pettyCashEntries.filter(p => p.type === 'out').reduce((s, p) => s + Number(p.amount || 0), 0);
    const subscriptionRevenue = subIncome.total;
    const subscriptionPaymentsCount = subIncome.count;
    const invoiceRevenue = invIncome.total;
    const chequeIn = chequeTx.incomeTotal;
    const chequeOut = chequeTx.expenseTotal;
    const advanceExpense = advanceExp.total;
    const loanDisbursement = loanTx.expenseTotal;
    const loanRepayment = loanTx.incomeTotal;
    const bankManualIncome = bankLedger.incomeTotal;
    const bankManualExpense = bankLedger.expenseTotal;

    const cashIncome = cashAgg.find(c => c._id === 'income')?.total || 0;
    const cashExpense = cashAgg.find(c => c._id === 'expense')?.total || 0;
    const cashInHand = cashIncome - cashExpense;

    const revenue = invoiceRevenue;
    const salaryPayout = paidPayrolls.reduce((s, p) => s + Number(p.netSalary || 0), 0);
    const incomeEntries = entries.filter((e) => e.type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);
    const expenseEntries = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalIncome = invoiceRevenue + incomeEntries + pettyCashIn + subscriptionRevenue + chequeIn + loanRepayment;
    const totalExpense = salaryPayout + expenseEntries + pettyCashOut + chequeOut + advanceExpense + loanDisbursement;
    const profit = totalIncome - totalExpense;

    const monthlyMap = new Map((revenueByMonth || []).map((r) => [r._id, r]));
    const normalizedRevenueSeries = MONTHS.map((m, idx) => {
      const row = monthlyMap.get(idx + 1);
      return { month: m, total: row?.total || 0, invoiceCount: row?.count || 0 };
    });

    const incomeBreakdown = entries.filter((e) => e.type === 'income')
      .reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
        return acc;
      }, {});
    if (pettyCashIn > 0) incomeBreakdown['Petty Cash (In)'] = (incomeBreakdown['Petty Cash (In)'] || 0) + pettyCashIn;
    if (subscriptionRevenue > 0) incomeBreakdown['Subscriptions'] = (incomeBreakdown['Subscriptions'] || 0) + subscriptionRevenue;
    if (invoiceRevenue > 0) incomeBreakdown['Invoices'] = (incomeBreakdown['Invoices'] || 0) + invoiceRevenue;
    if (chequeIn > 0) incomeBreakdown['Cheques (In)'] = (incomeBreakdown['Cheques (In)'] || 0) + chequeIn;
    if (loanRepayment > 0) incomeBreakdown['Loan Repayments'] = (loanRepayment);
    if (bankManualIncome > 0) incomeBreakdown['Bank Deposits'] = (bankManualIncome);

    const expenseBreakdown = entries.filter((e) => e.type === 'expense')
      .reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
        return acc;
      }, {});
    if (pettyCashOut > 0) expenseBreakdown['Petty Cash'] = (expenseBreakdown['Petty Cash'] || 0) + pettyCashOut;
    if (chequeOut > 0) expenseBreakdown['Cheques (Out)'] = (expenseBreakdown['Cheques (Out)'] || 0) + chequeOut;
    if (advanceExpense > 0) expenseBreakdown['Salary Advances'] = advanceExpense;
    if (loanDisbursement > 0) expenseBreakdown['Employee Loans'] = loanDisbursement;
    if (bankManualExpense > 0) expenseBreakdown['Bank Withdrawals'] = bankManualExpense;

    const topRevenueInvoices = [...paidInvoices]
      .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
      .slice(0, 8)
      .map((i) => ({
        invoiceNo: i.invoiceNo,
        clientName: i.client?.name || '—',
        projectTitle: i.project?.title || 'General Services',
        total: Number(i.total || 0),
        paidAt: i.paidAt,
      }));

    // Build recent entries including petty cash
    const recentFinance = entries.slice(0, 12).map((e) => ({
      type: e.type,
      category: e.category,
      title: e.title,
      amount: Number(e.amount || 0),
      date: e.date,
      note: e.note || '',
      paymentMethod: e.paymentMethod || '—',
      bankName: e.bankAccount?.bankName || '',
      branchName: e.branch?.name || '',
    }));
    normalizePettyCashEntries(pettyCashEntries).slice(0, 6).forEach((p) => {
      recentFinance.push({
        type: p.type,
        category: p.category,
        title: p.title,
        amount: p.amount,
        date: p.date,
        note: p.note || '',
        paymentMethod: p.paymentMethod,
        bankName: '',
        branchName: '',
      });
    });
    [...invIncome.entries, ...subIncome.entries, ...chequeTx.incomeEntries, ...chequeTx.expenseEntries, ...advanceExp.entries, ...loanTx.expenseEntries, ...loanTx.incomeEntries].slice(0, 6).forEach((p) => {
      recentFinance.push({
        type: p.type,
        category: p.category,
        title: p.title,
        amount: p.amount,
        date: p.date,
        note: p.note || '',
        paymentMethod: p.paymentMethod,
        bankName: '',
        branchName: '',
      });
    });
    recentFinance.sort((a, b) => new Date(b.date) - new Date(a.date));

    const uniqueRecent = [];
    const seenRecent = new Set();
    for (const e of recentFinance) {
      const key = e._id ? String(e._id) : `${e.type}-${e.amount}-${e.title}-${e.date}`;
      if (!seenRecent.has(key)) {
        seenRecent.add(key);
        uniqueRecent.push(e);
      }
    }

    const chartCategoryRows = (incomeExpenseByCategory || [])
      .filter((r) => !(r._id.type === 'income' && r._id.category === 'Subscriptions'))
      .map((r) => ({
        category: r._id.category,
        type: r._id.type,
        total: r.total,
      }));
    if (pettyCashIn > 0) chartCategoryRows.push({ category: 'Petty Cash (In)', type: 'income', total: pettyCashIn });
    if (pettyCashOut > 0) chartCategoryRows.push({ category: 'Petty Cash', type: 'expense', total: pettyCashOut });
    if (subscriptionRevenue > 0) chartCategoryRows.push({ category: 'Subscriptions', type: 'income', total: subscriptionRevenue });
    if (invoiceRevenue > 0) chartCategoryRows.push({ category: 'Invoices', type: 'income', total: invoiceRevenue });
    if (chequeIn > 0) chartCategoryRows.push({ category: 'Cheques (In)', type: 'income', total: chequeIn });
    if (chequeOut > 0) chartCategoryRows.push({ category: 'Cheques (Out)', type: 'expense', total: chequeOut });
    if (advanceExpense > 0) chartCategoryRows.push({ category: 'Salary Advances', type: 'expense', total: advanceExpense });
    if (loanDisbursement > 0) chartCategoryRows.push({ category: 'Employee Loans', type: 'expense', total: loanDisbursement });
    if (loanRepayment > 0) chartCategoryRows.push({ category: 'Loan Repayments', type: 'income', total: loanRepayment });

    const charts = {
      revenueByMonth: normalizedRevenueSeries,
      incomeExpenseByCategory: chartCategoryRows,
    };

    res.json({
      success: true,
      period: { from, to, month: req.query.month, year: req.query.year },
      summary: {
        revenue, salaryPayout, incomeEntries, expenseEntries, pettyCashIn, pettyCashOut,
        subscriptionRevenue, invoiceRevenue, chequeIn, chequeOut,
        advanceExpense, loanDisbursement, loanRepayment,
        bankDeposits: bankLedger.deposits, bankWithdrawals: bankLedger.withdrawals, bankNetFlow: bankLedger.netFlow,
        cashInHand,
        totalIncome, totalExpense, profit,
      },
      details: {
        paidInvoicesCount: paidInvoices.length,
        invoicePaymentsCount: paymentRevenueAgg.paymentCount,
        payrollRunsCount: paidPayrolls.length,
        entriesCount: entries.length + pettyCashEntries.length + subscriptionPaymentsCount,
        subscriptionPaymentsCount,
        pettyCashCount: pettyCashEntries.length,
        profitMarginPct: totalIncome > 0 ? Number(((profit / totalIncome) * 100).toFixed(2)) : 0,
        incomeBreakdown: Object.entries(incomeBreakdown).map(([cat, amount]) => ({ category: cat, amount })).sort((a, b) => b.amount - a.amount),
        expenseBreakdown: Object.entries(expenseBreakdown).map(([cat, amount]) => ({ category: cat, amount })).sort((a, b) => b.amount - a.amount),
        topRevenueInvoices,
        recentEntries: uniqueRecent.slice(0, 15),
      },
      charts,
    });
  } catch (err) { next(err); }
};

const { buildTabularExportHtml } = require('../services/documentHtmlService');

exports.exportData = async (req, res, next) => {
  try {
    const { dataset = 'financial_overview', format = 'excel', month, year, from, to, category, type, employeeId, branch, paymentMethod } = req.query;
    const lowerDataset = String(dataset).toLowerCase();
    const lowerFormat = String(format).toLowerCase();
    let headers = [];
    let rows = [];
    const employee = employeeId ? await Employee.findById(employeeId).populate('userId', 'name email role') : null;
    const employeeUserId = employee?.userId?._id;

    const branchMatch = branch ? { branch } : {};
    const empIds = await getEmpIds(branch);
    const empMatch = empIds ? { employee: { $in: empIds } } : {};
    const branchEmpMatch = branch ? { branch } : {};

    if (lowerDataset === 'salary_payments') {
      const payrolls = await Payroll.find({
        ...empMatch,
        ...(month ? { month: Number(month) } : {}),
        ...(year ? { year: Number(year) } : {}),
        ...(employeeId ? { employee: employeeId } : {}),
      }).populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } });
      headers = ['Employee', 'Employee No', 'Month', 'Year', 'Basic', 'Commissions', 'OT', 'Net', 'Status'];
      rows = payrolls.map((p) => [
        p.employee?.userId?.name,
        p.employee?.employeeNo,
        p.month,
        p.year,
        p.basicSalary,
        p.commissions || 0,
        p.overtime || 0,
        p.netSalary,
        p.status,
      ]);
    } else if (lowerDataset === 'epf_etf') {
      const payrolls = await Payroll.find({
        ...empMatch,
        ...(month ? { month: Number(month) } : {}),
        ...(year ? { year: Number(year) } : {}),
        ...(employeeId ? { employee: employeeId } : {}),
      }).populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } });
      headers = ['Employee', 'Month', 'Year', 'Basic', 'EPF Emp', 'EPF Employer', 'ETF Employer'];
      rows = payrolls.map((p) => [
        p.employee?.userId?.name, p.month, p.year, p.basicSalary, p.epfEmployee, p.epfEmployer, p.etfEmployer,
      ]);
    } else if (lowerDataset === 'employee_details') {
      const employees = await Employee.find({
        ...branchEmpMatch,
        ...(category ? { department: category } : {}),
      }).populate('userId', 'name email phone role');
      headers = ['Name', 'Email', 'Phone', 'Role', 'EmployeeNo', 'Department', 'Designation', 'Basic Salary', 'Status'];
      rows = employees.map((e) => [
        e.userId?.name, e.userId?.email, e.userId?.phone, e.userId?.role, e.employeeNo, e.department, e.designation, e.basicSalary, e.status,
      ]);
    } else if (lowerDataset === 'incomes' || lowerDataset === 'expenses') {
      const dateFilter = buildDateFilter({ from, to, month, year });
      const entryType = lowerDataset === 'incomes' ? 'income' : 'expense';
      const pmMatch = paymentMethod ? { paymentMethod } : {};
      const pcQ = { ...(branch ? { branch } : {}) };
      if (dateFilter) pcQ.date = dateFilter;

      const [rawEntries, pettyCash, subIncome, invIncome, chequeTx, advanceExp, loanTx] = await Promise.all([
        FinanceEntry.find({
          ...branchMatch,
          ...pmMatch,
          type: entryType,
          ...(category ? { category } : {}),
          ...(dateFilter ? { date: dateFilter } : {}),
        }).sort({ date: -1 }),
        PettyCash.find(pcQ).sort({ date: -1 }),
        entryType === 'income' ? resolveSubscriptionIncome(branch, dateFilter, paymentMethod) : Promise.resolve({ entries: [] }),
        entryType === 'income' ? resolveInvoicePaymentIncome(branch, dateFilter, paymentMethod) : Promise.resolve({ entries: [] }),
        resolveChequeTransactions(branch, dateFilter, paymentMethod),
        entryType === 'expense' ? resolveAdvanceExpenses(branch, dateFilter, paymentMethod) : Promise.resolve({ entries: [] }),
        resolveLoanTransactions(branch, dateFilter, paymentMethod),
      ]);

      const financeRows = rawEntries
        .filter((e) => !(entryType === 'income' && (isSubscriptionIncomeEntry(e) || isInvoiceIncomeEntry(e))))
        .map((e) => ({
          date: e.date, category: e.category, title: e.title, amount: e.amount,
          paymentMethod: e.paymentMethod || 'Cash', note: e.note || '',
        }));
      const pcRows = normalizePettyCashEntries(pettyCash, { type: entryType, paymentMethod });
      const extraIncome = entryType === 'income'
        ? [...subIncome.entries, ...invIncome.entries, ...chequeTx.incomeEntries, ...loanTx.incomeEntries]
        : [];
      const extraExpense = entryType === 'expense'
        ? [...chequeTx.expenseEntries, ...advanceExp.entries, ...loanTx.expenseEntries]
        : [];

      const merged = [...financeRows, ...pcRows, ...extraIncome, ...extraExpense]
        .filter((e) => !category || e.category === category)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      headers = ['Date', 'Category', 'Title', 'Amount', 'Payment Method', 'Note'];
      rows = merged.map((e) => [
        new Date(e.date).toLocaleDateString(), e.category, e.title, e.amount, e.paymentMethod || 'Cash', e.note || '',
      ]);
    } else if (lowerDataset === 'attendance_reports') {
      const records = await Attendance.find({
        ...empMatch,
        ...(employeeId ? { employee: employeeId } : {}),
        ...(from && to ? { date: { $gte: new Date(from), $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } } : (month && year ? { date: getRange(month, year) } : {})),
      }).populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } }).sort({ date: -1 });
      headers = ['Employee', 'Date', 'Status', 'Check In', 'Check Out', 'Notes'];
      rows = records.map((r) => [
        r.employee?.userId?.name,
        new Date(r.date).toLocaleDateString(),
        r.status,
        r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '—',
        r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—',
        r.notes || '',
      ]);
    } else if (lowerDataset === 'leave_reports') {
      const records = await Leave.find({
        ...empMatch,
        ...(employeeId ? { employee: employeeId } : {}),
        ...(from && to ? { startDate: { $gte: new Date(from), $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } } : (month && year ? { startDate: getRange(month, year) } : {})),
      }).populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } }).sort({ createdAt: -1 });
      headers = ['Employee', 'Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason'];
      rows = records.map((r) => [
        r.employee?.userId?.name,
        r.leaveType,
        new Date(r.startDate).toLocaleDateString(),
        new Date(r.endDate).toLocaleDateString(),
        r.days,
        r.status,
        r.reason,
      ]);
    } else if (lowerDataset === 'project_history') {
      const projects = await Project.find({
        ...branchMatch,
        ...(employeeUserId ? { assignedEmployees: employeeUserId } : {}),
      }).populate('assignedEmployees', 'name email').sort({ updatedAt: -1 });
      headers = ['Project', 'Status', 'Progress', 'Deadline', 'Assigned Employees', 'Updated At'];
      rows = projects.map((p) => [
        p.title,
        p.status,
        `${p.progress || 0}%`,
        p.deadline ? new Date(p.deadline).toLocaleDateString() : '—',
        (p.assignedEmployees || []).map((u) => u.name).join(', '),
        p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '—',
      ]);
    } else if (lowerDataset === 'revenue_invoices' || lowerDataset === 'invoices') {
      const invoices = await Invoice.find({
        ...branchMatch,
        ...(from && to ? { createdAt: { $gte: new Date(from), $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } } : (month && year ? { createdAt: getRange(month, year) } : {})),
      }).populate('client', 'name email').populate('project', 'title').sort({ createdAt: -1 });
      headers = ['Invoice No', 'Client', 'Project', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total', 'Due Date', 'Paid At'];
      rows = invoices.map((i) => [
        i.invoiceNo,
        i.client?.name,
        i.project?.title || '—',
        i.status,
        i.subtotal,
        i.discountTotal || 0,
        i.tax || 0,
        i.total,
        i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—',
        i.paidAt ? new Date(i.paidAt).toLocaleDateString() : '—',
      ]);
    } else if (lowerDataset === 'quotations') {
      const dateFilter = buildDateFilter({ from, to, month, year });
      const quotations = await Quotation.find({
        ...branchMatch,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      }).populate('client', 'name email').sort({ createdAt: -1 });
      headers = ['Quotation No', 'Client', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total', 'Valid Until', 'Created'];
      rows = quotations.map((q) => [
        q.quotationNo,
        q.client?.name,
        q.status,
        q.subtotal,
        q.discountTotal || 0,
        q.tax || 0,
        q.total,
        q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—',
        q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '—',
      ]);
    } else if (lowerDataset === 'cheques') {
      const dateFilter = buildDateFilter({ from, to, month, year });
      const chequeQ = { ...branchMatch };
      if (dateFilter) chequeQ.chequeDate = dateFilter;
      const cheques = await Cheque.find(chequeQ)
        .populate('bankAccount', 'bankName accountNumber')
        .sort({ chequeDate: -1 });
      headers = ['Cheque No', 'Direction', 'Source', 'Status', 'Amount', 'Bank', 'Account', 'Drawer/Payee', 'Date', 'Notes'];
      rows = cheques.map((c) => [
        c.chequeNumber,
        c.direction,
        c.source,
        c.status,
        c.amount,
        c.bankName || '',
        c.bankAccount ? `${c.bankAccount.bankName || ''} ${c.bankAccount.accountNumber || ''}`.trim() : '',
        c.drawerOrPayee || '',
        c.chequeDate ? new Date(c.chequeDate).toLocaleDateString() : '—',
        c.notes || '',
      ]);
      const totalAmt = cheques.reduce((s, c) => s + Number(c.amount || 0), 0);
      rows.push(['', '', '', 'TOTAL', totalAmt, '', '', '', '', '']);
    } else if (lowerDataset === 'petty_cash') {
      const dateFilter = buildDateFilter({ from, to, month, year });
      const pcQ = { ...branchMatch };
      if (dateFilter) pcQ.date = dateFilter;
      const petty = await PettyCash.find(pcQ).sort({ date: -1 });
      headers = ['Date', 'Type', 'Description', 'Amount', 'Paid To', 'Payment Method', 'Bank Account'];
      rows = petty.map((p) => [
        p.date ? new Date(p.date).toLocaleDateString() : '—',
        p.type,
        p.description,
        p.amount,
        p.paidTo || '',
        p.paymentMethod || '',
        p.bankAccount || '',
      ]);
      const totalIn = petty.filter((p) => p.type === 'in').reduce((s, p) => s + Number(p.amount || 0), 0);
      const totalOut = petty.filter((p) => p.type === 'out').reduce((s, p) => s + Number(p.amount || 0), 0);
      rows.push(['', 'SUMMARY', 'Total In', totalIn, '', '', '']);
      rows.push(['', 'SUMMARY', 'Total Out', totalOut, '', '', '']);
      rows.push(['', 'SUMMARY', 'Net Balance', totalIn - totalOut, '', '', '']);
    } else if (lowerDataset === 'clients' || lowerDataset === 'customers') {
      const userQ = { role: 'client', ...(branch ? { branch } : {}) };
      const clientUsers = await User.find(userQ).select('name email phone isActive createdAt').sort({ name: 1 });
      const profiles = await ClientProfile.find({ userId: { $in: clientUsers.map((u) => u._id) } });
      const profileMap = profiles.reduce((acc, p) => { acc[p.userId.toString()] = p; return acc; }, {});
      headers = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Created'];
      rows = clientUsers.map((u) => {
        const p = profileMap[u._id.toString()];
        return [
          u.name,
          u.email || '',
          u.phone || '',
          p?.companyName || '',
          p?.status || (u.isActive ? 'Active' : 'Inactive'),
          u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
        ];
      });
    } else {
      const dateFilter = buildDateFilter({ from, to, month, year });
      const range = dateFilter || getRange(Number(month || (new Date().getMonth() + 1)), Number(year || new Date().getFullYear()));
      const pmMatch = paymentMethod ? { paymentMethod } : {};

      const [
        rawIncomeEntries, rawExpenseEntries, payrollRuns, pettyCash,
        subIncomeResolved, invIncomeResolved, chequeTx, advanceExp, loanTx, bankLedger,
      ] = await Promise.all([
        FinanceEntry.find({ ...branchMatch, ...pmMatch, type: 'income', date: range }).sort({ date: -1 }),
        FinanceEntry.find({ ...branchMatch, ...pmMatch, type: 'expense', date: range }).sort({ date: -1 }),
        Payroll.find({ ...empMatch, status: 'paid', paidAt: range, ...pmMatch })
          .populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } }),
        PettyCash.find({ ...branchMatch, date: range }),
        resolveSubscriptionIncome(branch, range, paymentMethod),
        resolveInvoicePaymentIncome(branch, range, paymentMethod),
        resolveChequeTransactions(branch, range, paymentMethod),
        resolveAdvanceExpenses(branch, range, paymentMethod),
        resolveLoanTransactions(branch, range, paymentMethod),
        resolveBankLedgerTransactions(branch, range),
      ]);

      const incomeEntries = rawIncomeEntries.filter((e) => !isSubscriptionIncomeEntry(e) && !isInvoiceIncomeEntry(e));
      const expenseEntries = rawExpenseEntries;
      const pcIncome = normalizePettyCashEntries(pettyCash, { type: 'income', paymentMethod });
      const pcExpense = normalizePettyCashEntries(pettyCash, { type: 'expense', paymentMethod });
      const bankIncome = (bankLedger.entries || []).filter((e) => e.type === 'income' && e.countsInTotals !== false);
      const bankExpense = (bankLedger.entries || []).filter((e) => e.type === 'expense' && e.countsInTotals !== false);

      const allIncome = [
        ...incomeEntries.map((e) => ({ ...e.toObject(), source: 'Finance Entry' })),
        ...pcIncome.map((e) => ({ ...e, source: 'Petty Cash' })),
        ...subIncomeResolved.entries.map((e) => ({ ...e, source: 'Subscription' })),
        ...invIncomeResolved.entries.map((e) => ({ ...e, source: 'Invoice' })),
        ...chequeTx.incomeEntries.map((e) => ({ ...e, source: 'Cheque' })),
        ...loanTx.incomeEntries.map((e) => ({ ...e, source: 'Loan' })),
      ];
      const allExpense = [
        ...expenseEntries.map((e) => ({ ...e.toObject(), source: 'Finance Entry' })),
        ...pcExpense.map((e) => ({ ...e, source: 'Petty Cash' })),
        ...chequeTx.expenseEntries.map((e) => ({ ...e, source: 'Cheque' })),
        ...advanceExp.entries.map((e) => ({ ...e, source: 'Advance' })),
        ...loanTx.expenseEntries.map((e) => ({ ...e, source: 'Loan' })),
      ];

      const financeOnlyIncome = incomeEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
      const financeOnlyExpense = expenseEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
      const salaryPayout = payrollRuns.reduce((s, p) => s + Number(p.netSalary || 0), 0);
      const subRevenue = subIncomeResolved.total;
      const invoiceRevenue = invIncomeResolved.total;
      const pcIn = pcIncome.reduce((s, e) => s + Number(e.amount || 0), 0);
      const pcOut = pcExpense.reduce((s, e) => s + Number(e.amount || 0), 0);
      const chequeIn = chequeTx.incomeTotal;
      const chequeOut = chequeTx.expenseTotal;
      const advanceExpense = advanceExp.total;
      const loanDisbursement = loanTx.expenseTotal;
      const loanRepayment = loanTx.incomeTotal;
      const bankIn = bankIncome.reduce((s, e) => s + Number(e.amount || 0), 0);
      const bankOut = bankExpense.reduce((s, e) => s + Number(e.amount || 0), 0);

      const totalIncome = allIncome.reduce((s, e) => s + Number(e.amount || 0), 0);
      const totalExpense = allExpense.reduce((s, e) => s + Number(e.amount || 0), 0) + salaryPayout;
      const profit = totalIncome - totalExpense;

      const ledger = [];
      payrollRuns.forEach((p) => ledger.push({
        rawDate: p.paidAt ? new Date(p.paidAt) : new Date(0),
        row: [
          p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—',
          'Payroll', 'expense', 'Salary',
          `Salary Payout ${p.employee?.userId?.name || ''} (${p.month}/${p.year})`,
          Number(p.netSalary || 0), p.paymentMethod || 'Cash', '',
        ],
      }));
      [...allIncome, ...allExpense, ...bankIncome.map((e) => ({ ...e, source: 'Bank' })), ...bankExpense.map((e) => ({ ...e, source: 'Bank' }))].forEach((e) => ledger.push({
        rawDate: e.date ? new Date(e.date) : new Date(0),
        row: [
          e.date ? new Date(e.date).toLocaleDateString() : '—',
          e.source || 'Finance Entry', e.type, e.category || '—', e.title || '—',
          Number(e.amount || 0), e.paymentMethod || 'Cash', e.note || '',
        ],
      }));
      ledger.sort((a, b) => b.rawDate - a.rawDate);

      const filterNote = paymentMethod ? ` · Method: ${paymentMethod}` : '';
      headers = ['Date', 'Source', 'Type', 'Category', 'Title', 'Amount', 'Method', 'Note'];
      rows = [
        ['Summary', 'System', 'income', 'Invoices', `Invoice payments${filterNote}`, invoiceRevenue, paymentMethod || 'All', ''],
        ['Summary', 'System', 'income', 'Subscriptions', `Subscription payments${filterNote}`, subRevenue, paymentMethod || 'All', ''],
        ['Summary', 'System', 'income', 'Finance Entries', `Other income entries${filterNote}`, financeOnlyIncome, paymentMethod || 'All', ''],
        ['Summary', 'System', 'expense', 'Finance Entries', `Other expense entries${filterNote}`, financeOnlyExpense, paymentMethod || 'All', ''],
        ['Summary', 'System', 'expense', 'Salary', 'Salary payout', salaryPayout, paymentMethod || 'All', ''],
        ['Summary', 'System', 'income', 'Petty Cash', 'Petty Cash (In)', pcIn, paymentMethod || 'All', ''],
        ['Summary', 'System', 'expense', 'Petty Cash', 'Petty Cash (Out)', pcOut, paymentMethod || 'All', ''],
        ['Summary', 'System', 'income', 'Cheques', 'Cheque income', chequeIn, paymentMethod || 'All', ''],
        ['Summary', 'System', 'expense', 'Cheques', 'Cheque expense', chequeOut, paymentMethod || 'All', ''],
        ['Summary', 'System', 'expense', 'Advances', 'Employee advances', advanceExpense, paymentMethod || 'All', ''],
        ['Summary', 'System', 'expense', 'Loans', 'Loan disbursements', loanDisbursement, paymentMethod || 'All', ''],
        ['Summary', 'System', 'income', 'Loans', 'Loan repayments', loanRepayment, paymentMethod || 'All', ''],
        ['Summary', 'System', 'income', 'Bank', 'Bank deposits (ledger)', bankIn, '—', ''],
        ['Summary', 'System', 'expense', 'Bank', 'Bank withdrawals (ledger)', bankOut, '—', ''],
        ['Summary', 'System', 'income', 'Total', 'Total income', totalIncome, '', ''],
        ['Summary', 'System', 'expense', 'Total', 'Total expense', totalExpense, '', ''],
        ['Summary', 'System', profit >= 0 ? 'income' : 'expense', 'Profit', 'Net profit', profit, '', ''],
        ...ledger.map((x) => x.row),
      ];
    }

    if (lowerFormat === 'excel') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Export');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${lowerDataset}.xlsx"`);
      return res.send(buf);
    }

    if (lowerFormat === 'pdf') {
      const metaLine = `Generated: ${new Date().toLocaleString()} · ${rows.length} rows`;
      const html = await buildTabularExportHtml(`${lowerDataset.replace(/_/g, ' ')}`, headers, rows, metaLine);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    if (lowerFormat === 'csv') {
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${lowerDataset}.csv"`);
      return res.send(csv);
    }

    return res.status(400).json({ success: false, message: 'Invalid format' });
  } catch (err) { next(err); }
};

// POST /api/finance/sync-subscription-income — backfill missing finance rows from subscription payments
exports.syncSubscriptionIncome = async (req, res, next) => {
  try {
    const [sub, inv] = await Promise.all([
      backfillSubscriptionFinanceEntries(req.user._id),
      backfillInvoiceFinanceEntries(req.user._id),
    ]);
    res.json({
      success: true,
      message: `Synced income (subscriptions: ${sub.created}, invoices: ${inv.created})`,
      subscriptions: sub,
      invoices: inv,
    });
  } catch (err) { next(err); }
};

// GET /api/finance/profit-loss
exports.getProfitLoss = async (req, res, next) => {
  try {
    const { from, to, branch, paymentMethod } = req.query;
    const branchMatch = branch ? { branch } : {};
    const empIds = await getEmpIds(branch);
    const empMatch = empIds ? { employee: { $in: empIds } } : {};
    const pmMatch = paymentMethod ? { paymentMethod } : {};

    const startDate = from ? parseLocalDateStart(from) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = to ? parseLocalDateEnd(to) : parseLocalDateEnd(new Date().toISOString().split('T')[0]);
    const dateRange = { $gte: startDate, $lte: endDate };
    const [rawIncomeEntries, rawExpenseEntries, invoicePayments, payrollRuns, pettyCash, subIncomeResolved, invIncomeResolved, chequeTx, paymentRevenueAgg, advanceExp, loanTx, bankLedger] = await Promise.all([
      FinanceEntry.find({ ...branchMatch, ...pmMatch, type: 'income', date: dateRange }).sort({ date: -1 }),
      FinanceEntry.find({ ...branchMatch, ...pmMatch, type: 'expense', date: dateRange }).sort({ date: -1 }),
      Invoice.find({ ...branchMatch, status: { $nin: ['cancelled', 'draft'] }, 'payments.0': { $exists: true } }).populate('client', 'name email').sort({ updatedAt: -1 }),
      Payroll.find({ ...empMatch, status: 'paid', paidAt: dateRange }).populate({ path: 'employee', populate: { path: 'userId', select: 'name' } }).sort({ paidAt: -1 }),
      PettyCash.find({ ...branchMatch, date: dateRange }).sort({ date: -1 }),
      resolveSubscriptionIncome(branch, dateRange, paymentMethod),
      resolveInvoicePaymentIncome(branch, dateRange, paymentMethod),
      resolveChequeTransactions(branch, dateRange, paymentMethod),
      aggregateInvoicePaymentRevenue(branchMatch, dateRange),
      resolveAdvanceExpenses(branch, dateRange, paymentMethod),
      resolveLoanTransactions(branch, dateRange, paymentMethod),
      resolveBankLedgerTransactions(branch, dateRange),
    ]);

    const incomeEntries = rawIncomeEntries.filter((e) => !isSubscriptionIncomeEntry(e) && !isInvoiceIncomeEntry(e));
    const expenseEntries = rawExpenseEntries;
    const pcIncome = normalizePettyCashEntries(pettyCash, { type: 'income', paymentMethod });
    const pcExpense = normalizePettyCashEntries(pettyCash, { type: 'expense', paymentMethod });
    const subIncome = subIncomeResolved.entries;
    const invIncome = invIncomeResolved.entries;

    const bankIncome = (bankLedger.entries || []).filter((e) => e.type === 'income' && e.countsInTotals !== false);
    const bankExpense = (bankLedger.entries || []).filter((e) => e.type === 'expense' && e.countsInTotals !== false);

    const allIncomeEntries = [
      ...incomeEntries.map((e) => e.toObject ? e.toObject() : e),
      ...pcIncome, ...subIncome, ...invIncome, ...chequeTx.incomeEntries,
      ...loanTx.incomeEntries,
    ];
    const allExpenseEntries = [
      ...expenseEntries.map((e) => e.toObject ? e.toObject() : e),
      ...pcExpense, ...chequeTx.expenseEntries,
      ...advanceExp.entries, ...loanTx.expenseEntries,
    ];

    const financeOnlyIncome = incomeEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
    const financeOnlyExpense = expenseEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalIncomeEntries = allIncomeEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalExpenseEntries = allExpenseEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalInvoiceRevenue = paymentRevenueAgg.total;
    const totalSalaryExpense = payrollRuns.reduce((s, p) => s + Number(p.netSalary || 0), 0);
    const subscriptionRevenue = subIncomeResolved.total;
    const invoiceRevenue = invIncomeResolved.total;
    const pettyCashIn = pcIncome.reduce((s, e) => s + Number(e.amount || 0), 0);
    const pettyCashOut = pcExpense.reduce((s, e) => s + Number(e.amount || 0), 0);
    const chequeIn = chequeTx.incomeTotal;
    const chequeOut = chequeTx.expenseTotal;
    const advanceExpense = advanceExp.total;
    const loanDisbursement = loanTx.expenseTotal;
    const loanRepayment = loanTx.incomeTotal;

    const totalIncome = totalIncomeEntries;
    const totalExpense = totalExpenseEntries + totalSalaryExpense;
    const netProfit = totalIncome - totalExpense;

    // By payment method breakdown
    const byMethod = {};
    [...allIncomeEntries, ...allExpenseEntries].forEach(e => {
      const m = e.paymentMethod || 'Cash';
      if (!byMethod[m]) byMethod[m] = { income: 0, expense: 0 };
      byMethod[m][e.type] = (byMethod[m][e.type] || 0) + e.amount;
    });

    // By category breakdown
    const incomeCategoryMap = {};
    allIncomeEntries.forEach(e => { incomeCategoryMap[e.category] = (incomeCategoryMap[e.category] || 0) + e.amount; });
    const expenseCategoryMap = {};
    allExpenseEntries.forEach(e => { expenseCategoryMap[e.category] = (expenseCategoryMap[e.category] || 0) + e.amount; });
    const bankManualIncome = bankLedger.incomeTotal || 0;
    const bankManualExpense = bankLedger.expenseTotal || 0;
    const cashInHand = 0; // Or calculate if needed

    res.json({
      success: true,
      period: { from: startDate, to: endDate },
      summary: {
        totalIncome,
        totalExpense,
        netProfit,
        totalInvoiceRevenue,
        totalSalaryExpense,
        totalIncomeEntries,
        totalExpenseEntries,
        otherIncomeEntries: financeOnlyIncome,
        otherExpenseEntries: financeOnlyExpense,
        subscriptionRevenue,
        invoiceRevenue,
        pettyCashIn,
        pettyCashOut,
        chequeIn,
        chequeOut,
        advanceExpense,
        loanDisbursement,
        loanRepayment,
        bankDeposits: bankManualIncome,
        bankWithdrawals: bankManualExpense,
        cashInHand,
        bankNetFlow: bankLedger.netFlow || 0,
      },
      incomeEntries: allIncomeEntries,
      expenseEntries: allExpenseEntries,
      bankEntries: [...bankIncome, ...bankExpense],
      invoicePayments,
      payrollRuns,
      byMethod: Object.entries(byMethod).map(([method, vals]) => ({ method, ...vals })),
      incomeCategoryBreakdown: Object.entries(incomeCategoryMap).map(([cat, amt]) => ({ category: cat, amount: amt })).sort((a, b) => b.amount - a.amount),
      expenseCategoryBreakdown: Object.entries(expenseCategoryMap).map(([cat, amt]) => ({ category: cat, amount: amt })).sort((a, b) => b.amount - a.amount),
    });
  } catch (err) { next(err); }
};
