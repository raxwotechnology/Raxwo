const BankAccount = require('../models/BankAccount');

function mapTx(tx, account, branchName) {
  return {
    _id: tx._id,
    bankAccountId: account._id,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    branch: account.branch,
    branchName: branchName || '',
    date: tx.date,
    transactionType: tx.transactionType || tx.type,
    type: tx.type,
    paymentType: tx.paymentType || tx.transactionType || tx.type,
    referenceId: tx.referenceId || tx.reference,
    moduleSource: tx.moduleSource || 'manual',
    amount: tx.amount,
    balanceBefore: tx.balanceBefore ?? null,
    balanceAfter: tx.balanceAfter,
    description: tx.description,
    performedBy: tx.recordedBy?.name || '—',
    recordedBy: tx.recordedBy,
  };
}

// GET /api/bank-accounts/history/transactions
exports.getTransactionHistory = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.branch) query.branch = req.query.branch;
    if (req.query.bankAccount) query._id = req.query.bankAccount;

    const accounts = await BankAccount.find(query)
      .populate('branch', 'name')
      .populate('transactions.recordedBy', 'name email')
      .lean();

    const from = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const to = req.query.toDate ? new Date(req.query.toDate) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const moduleSource = req.query.moduleSource || req.query.transactionType;
    const txType = req.query.type;
    const paymentType = req.query.paymentType;

    let rows = [];
    accounts.forEach((acc) => {
      (acc.transactions || []).forEach((tx) => {
        const d = new Date(tx.date);
        if (from && d < from) return;
        if (to && d > to) return;
        if (moduleSource && String(tx.moduleSource || 'manual') !== moduleSource) return;
        if (txType && String(tx.type) !== txType) return;
        if (paymentType && String(tx.transactionType || tx.type) !== paymentType) return;
        rows.push(mapTx({ ...tx, recordedBy: tx.recordedBy }, acc, acc.branch?.name));
      });
    });

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const total = rows.length;
    const skip = (page - 1) * limit;
    const transactions = rows.slice(skip, skip + limit);

    res.json({
      success: true,
      transactions,
      page,
      total,
      hasMore: skip + limit < total,
      summary: {
        totalCredits: rows.filter((r) => ['deposit', 'transfer_in'].includes(r.type)).reduce((s, r) => s + r.amount, 0),
        totalDebits: rows.filter((r) => !['deposit', 'transfer_in'].includes(r.type)).reduce((s, r) => s + r.amount, 0),
      },
    });
  } catch (err) { next(err); }
};

// GET /api/bank-accounts
exports.getAccounts = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.branch) query.branch = req.query.branch;
    const accounts = await BankAccount.find(query)
      .populate('transactions.recordedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, count: accounts.length, accounts });
  } catch (err) { next(err); }
};

// GET /api/bank-accounts/:id/transactions
exports.getAccountTransactions = async (req, res, next) => {
  try {
    const account = await BankAccount.findById(req.params.id)
      .populate('transactions.recordedBy', 'name email')
      .lean();

    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 25));
    const sorted = [...(account.transactions || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = sorted.length;
    const skip = (page - 1) * limit;
    const slice = sorted.slice(skip, skip + limit);

    const transactions = slice.map(tx => ({
      _id: tx._id,
      date: tx.date,
      transactionType: tx.transactionType || tx.type,
      type: tx.type,
      referenceId: tx.referenceId || tx.reference,
      moduleSource: tx.moduleSource || 'manual',
      amount: tx.amount,
      balanceBefore: tx.balanceBefore ?? null,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
      performedBy: tx.recordedBy?.name || '—',
      recordedBy: tx.recordedBy,
    }));

    res.json({
      success: true,
      account: {
        _id: account._id,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        currentBalance: account.currentBalance,
      },
      transactions,
      page,
      total,
      hasMore: skip + limit < total,
    });
  } catch (err) { next(err); }
};

// POST /api/bank-accounts
exports.createAccount = async (req, res, next) => {
  try {
    const account = await BankAccount.create({ ...req.body });
    res.status(201).json({ success: true, account });
  } catch (err) { next(err); }
};

// PUT /api/bank-accounts/:id
exports.updateAccount = async (req, res, next) => {
  try {
    const allowed = ['bankName', 'accountHolder', 'accountType', 'branchName', 'currency', 'notes', 'isActive'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const account = await BankAccount.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, account });
  } catch (err) { next(err); }
};

// DELETE /api/bank-accounts/:id
exports.deleteAccount = async (req, res, next) => {
  try {
    const account = await BankAccount.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Account removed' });
  } catch (err) { next(err); }
};

// POST /api/bank-accounts/:id/transaction
exports.recordTransaction = async (req, res, next) => {
  try {
    const { type, amount, description, date, reference, moduleSource } = req.body;
    const account = await BankAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const balanceBefore = account.currentBalance || 0;
    const isCredit = ['deposit', 'transfer_in'].includes(type);
    account.currentBalance = balanceBefore + (isCredit ? amt : -amt);

    account.transactions.push({
      type,
      transactionType: type,
      amount: amt,
      balanceBefore,
      balanceAfter: account.currentBalance,
      description: description || '',
      date: date ? new Date(date) : new Date(),
      reference: reference || '',
      referenceId: reference || '',
      moduleSource: moduleSource || 'manual',
      sourceType: 'Manual',
      recordedBy: req.user?._id,
    });

    await account.save();
    res.json({ success: true, account });
  } catch (err) { next(err); }
};

// DELETE /api/bank-accounts/:accountId/transaction/:transactionId
exports.deleteTransaction = async (req, res, next) => {
  try {
    const account = await BankAccount.findById(req.params.accountId);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const txIndex = account.transactions.findIndex(t => String(t._id) === req.params.transactionId);
    if (txIndex === -1) return res.status(404).json({ success: false, message: 'Transaction not found' });

    const tx = account.transactions[txIndex];
    // Reverse the balance impact
    const isCredit = ['deposit', 'transfer_in'].includes(tx.type);
    const amt = Number(tx.amount) || 0;
    account.currentBalance = (account.currentBalance || 0) + (isCredit ? -amt : amt);

    account.transactions.splice(txIndex, 1);
    await account.save();

    res.json({ success: true, message: 'Transaction deleted and balance reverted', account });
  } catch (err) { next(err); }
};
