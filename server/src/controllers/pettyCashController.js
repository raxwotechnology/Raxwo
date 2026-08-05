const PettyCash = require('../models/PettyCash');
const BankAccount = require('../models/BankAccount');
const Cheque = require('../models/Cheque');
const { appendBankTransaction } = require('../utils/bankLedger');
const { syncChequeBankLedger, reverseChequeBankLedger } = require('../utils/chequeLedger');

// GET /api/petty-cash
exports.getTransactions = async (req, res, next) => {
  try {
    const { type, category, startDate, endDate, branch } = req.query;
    const query = {};
    if (type) query.type = type;
    if (category) query.category = category;
    if (branch) query.branch = branch;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); query.date.$lte = e; }
    }
    const transactions = await PettyCash.find(query)
      .populate('recordedBy', 'name')
      .populate('branch', 'name')
      .populate('bankAccount', 'bankName accountNumber')
      .sort({ date: -1 });

    const totalIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);

    const balanceQuery = branch ? { branch } : {};
    const cashFilter = (t) => !t.paymentType || String(t.paymentType).toLowerCase() === 'cash';
    const allForBalance = await PettyCash.find(balanceQuery).lean();
    const cashRows = allForBalance.filter(cashFilter);
    const allIn = cashRows.filter(t => t.type === 'in').reduce((s, t) => s + Number(t.amount || 0), 0);
    const allOut = cashRows.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount || 0), 0);
    const currentBalance = allIn - allOut;

    res.json({ success: true, count: transactions.length, transactions, summary: { totalIn, totalOut, currentBalance } });
  } catch (err) { next(err); }
};

// POST /api/petty-cash
exports.createTransaction = async (req, res, next) => {
  try {
    const { type, amount, date, description, category, paidTo, paymentType, referenceNumber, chequeNumber, receiptUrl, branch, bankAccount } = req.body;
    const normPaymentType = String(paymentType || 'cash').toLowerCase();

    // For OUT via CASH: check physical petty cash balance
    if (type === 'out' && normPaymentType === 'cash') {
      const balanceQuery = branch ? { branch } : {};
      const all = await PettyCash.find(balanceQuery).lean();
      const cashTransactions = all.filter(t => !t.paymentType || String(t.paymentType).toLowerCase() === 'cash');
      const balance = cashTransactions.reduce((s, t) => t.type === 'in' ? s + t.amount : s - t.amount, 0);
      if (Number(amount) > balance) {
        return res.status(400).json({ success: false, message: `Insufficient physical cash balance. Current cash: LKR ${balance.toFixed(2)}` });
      }
    }

    let linkedChequeDoc = null;
    const isCheque = normPaymentType === 'cheque';
    const usesBank = bankAccount && ['bank_transfer', 'card'].includes(normPaymentType);

    if (isCheque) {
      if (!bankAccount) {
        return res.status(400).json({ success: false, message: 'Bank account is required when payment method is Cheque' });
      }
      const chqNum = String(chequeNumber || referenceNumber || '').trim();
      if (!chqNum) {
        return res.status(400).json({ success: false, message: 'Cheque number is required when payment method is Cheque' });
      }
      const acc = await BankAccount.findById(bankAccount);
      if (!acc) return res.status(404).json({ success: false, message: 'Selected Bank Account not found' });

      const isOut = type === 'out';
      linkedChequeDoc = await Cheque.create({
        direction: isOut ? 'issued' : 'received',
        source: 'expense',
        status: 'cleared',
        amount: Number(amount),
        currency: 'LKR',
        chequeNumber: chqNum,
        chequeDate: date ? new Date(date) : new Date(),
        bankName: acc.bankName || '',
        drawerOrPayee: paidTo || description || '',
        notes: `Petty Cash Expense: ${description}`,
        bankAccount,
        branch: branch || undefined,
        recordedBy: req.user._id,
      });

      // Auto sync bank ledger (deducts/credits money from bank account)
      await syncChequeBankLedger(linkedChequeDoc, { recordedBy: req.user._id });
    } else if (usesBank) {
      const acc = await BankAccount.findById(bankAccount);
      if (!acc) return res.status(404).json({ success: false, message: 'Selected Bank Account not found' });
      const amt = Number(amount);
      const isIn = type === 'in';
      await appendBankTransaction(bankAccount, {
        type: isIn ? 'deposit' : 'withdrawal',
        amount: amt,
        description: `Petty Cash ${isIn ? 'IN' : 'OUT'}: ${description} (${category})`,
        date: date ? new Date(date) : new Date(),
        reference: referenceNumber || '',
        moduleSource: 'petty_cash',
        sourceType: 'PettyCash',
        recordedBy: req.user._id,
      });
    }

    const balanceQuery = branch ? { branch } : {};
    const priorCash = await PettyCash.find(balanceQuery).lean();
    const isCashPayment = normPaymentType === 'cash';
    const priorBalance = priorCash
      .filter(t => !t.paymentType || String(t.paymentType).toLowerCase() === 'cash')
      .reduce((s, t) => (t.type === 'in' ? s + Number(t.amount || 0) : s - Number(t.amount || 0)), 0);
    const amt = Number(amount);
    const runningBalance = isCashPayment
      ? (type === 'in' ? priorBalance + amt : priorBalance - amt)
      : priorBalance;

    const chqNum = String(chequeNumber || referenceNumber || '').trim();
    const transaction = await PettyCash.create({
      type, amount: amt, date: date || new Date(),
      description, category, paidTo, paymentType: normPaymentType,
      referenceNumber: referenceNumber || '',
      chequeNumber: chqNum,
      linkedCheque: linkedChequeDoc ? linkedChequeDoc._id : undefined,
      receiptUrl, branch, bankAccount, recordedBy: req.user._id, runningBalance,
    });
    res.status(201).json({ success: true, transaction });
  } catch (err) { next(err); }
};

// DELETE /api/petty-cash/:id
exports.deleteTransaction = async (req, res, next) => {
  try {
    const t = await PettyCash.findById(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: 'Transaction not found' });

    const normPaymentType = String(t.paymentType || '').toLowerCase();
    if (normPaymentType === 'cheque' && t.linkedCheque) {
      const chq = await Cheque.findById(t.linkedCheque);
      if (chq) {
        await reverseChequeBankLedger(chq, { recordedBy: req.user._id });
        await Cheque.findByIdAndDelete(chq._id);
      }
    } else if (t.bankAccount && ['bank_transfer', 'card'].includes(normPaymentType)) {
      const wasIn = t.type === 'in';
      await appendBankTransaction(t.bankAccount, {
        type: wasIn ? 'withdrawal' : 'deposit',
        amount: t.amount,
        description: `Petty Cash reversal (deleted): ${t.description}`,
        date: new Date(),
        reference: t.referenceNumber || '',
        moduleSource: 'petty_cash',
        recordedBy: req.user._id,
      });
    }

    await PettyCash.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) { next(err); }
};

// PUT /api/petty-cash/:id
exports.updateTransaction = async (req, res, next) => {
  try {
    const { amount, date, description, category, paidTo, paymentType, referenceNumber, branch } = req.body;
    let t = await PettyCash.findById(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: 'Transaction not found' });

    t.amount = amount !== undefined ? Number(amount) : t.amount;
    t.date = date !== undefined ? new Date(date) : t.date;
    t.description = description !== undefined ? description : t.description;
    t.category = category !== undefined ? category : t.category;
    t.paidTo = paidTo !== undefined ? paidTo : t.paidTo;
    t.paymentType = paymentType !== undefined ? paymentType : t.paymentType;
    t.referenceNumber = referenceNumber !== undefined ? referenceNumber : t.referenceNumber;
    t.branch = branch !== undefined ? branch : t.branch;

    await t.save();
    res.json({ success: true, transaction: t });
  } catch (err) { next(err); }
};
