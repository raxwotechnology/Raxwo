const Invoice    = require('../models/Invoice');
const Quotation  = require('../models/Quotation');
const User       = require('../models/User');
const Branch     = require('../models/Branch');
const BankAccount= require('../models/BankAccount');
const Payment    = require('../models/Payment');
const Project    = require('../models/Project');
const SiteSetting= require('../models/SiteSetting');
const crypto     = require('crypto');
const { createNotification } = require('../services/notificationService');
const { awardPoints }        = require('../services/rewardService');
const { isLedgerBankMethod, appendBankTransaction } = require('../utils/bankLedger');
const { verifyActionPassword } = require('../utils/actionPassword');
const { createAuditLog } = require('./auditController');
const { allocateInvoiceNoFromQuotationNo, generateAutoInvoiceNo } = require('../utils/allocateInvoiceNoFromQuotation');
const { syncProjectsForInvoice } = require('../utils/projectInvoiceSync');
const { logInvoicePaymentIncome, deleteInvoiceFinanceEntries } = require('../utils/financeInvoiceIncome');

const POPULATE_INVOICE = [
  { path: 'client',       select: 'name email phone' },
  { path: 'project',      select: 'title' },
  { path: 'quotationRef', select: 'quotationNo title' },
  { path: 'branch',       select: 'name' },
  { path: 'createdBy',    select: 'name' },
  { path: 'payments.recordedBy', select: 'name' },
  { path: 'bankAccount',  select: 'bankName accountNumber branchName' },
];

// ─── Helper: recalc line totals ───────────────────────────────────────────────
function calcItems(items = [], taxRate = 0, globalDiscountValue = 0, globalDiscountType = 'fixed') {
  let subtotal = 0, lineDiscounts = 0;
  const calcedItems = items.map(item => {
    const base      = Number(item.quantity || 1) * Number(item.unitPrice || 0);
    const discAmt   = base * (Number(item.discount || 0) / 100);
    const afterDisc = base - discAmt;
    const taxAmt    = afterDisc * (Number(item.tax || 0) / 100);
    const total     = afterDisc + taxAmt;
    subtotal     += base;
    lineDiscounts+= discAmt;
    return { ...item, total: parseFloat(total.toFixed(2)) };
  });
  
  let globalDiscAmt = 0;
  if (globalDiscountType === 'percentage') {
    globalDiscAmt = Math.max(0, subtotal - lineDiscounts) * (Number(globalDiscountValue || 0) / 100);
  } else {
    globalDiscAmt = Number(globalDiscountValue || 0);
  }

  const totalDiscount = lineDiscounts + globalDiscAmt;
  const taxable = Math.max(0, subtotal - totalDiscount);
  const globalTax = taxable * (Number(taxRate) / 100);
  const grandTotal = taxable + globalTax;
  return {
    items: calcedItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discountTotal: parseFloat(totalDiscount.toFixed(2)),
    tax: parseFloat(globalTax.toFixed(2)),
    total: parseFloat(grandTotal.toFixed(2)),
  };
}

// ─── GET all invoices ─────────────────────────────────────────────────────────
exports.getInvoices = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'client') query.client = req.user._id;
    if (req.query.status)   query.status  = req.query.status;
    if (req.query.branch)   query.branch  = req.query.branch;
    if (req.query.client)   query.client  = req.query.client;
    if (req.query.project)  query.project = req.query.project;
    if (req.query.serviceType) query.serviceType = req.query.serviceType;
    if (req.query.paymentMethod) query.paymentMethod = req.query.paymentMethod;
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate + 'T23:59:59.999Z');
    }

    // Source filter: 'subscription' = subscription invoices only, anything else = regular only
    if (req.query.source === 'subscription') {
      query.source = 'subscription';
    } else {
      // Default: exclude subscription-generated invoices from the regular invoices tab
      query.$or = [{ source: 'manual' }, { source: { $exists: false } }, { source: null }];
    }

    // Auto-mark overdue — fire-and-forget (non-blocking, does not delay the GET response)
    const now = new Date();
    Invoice.updateMany(
      { status: { $in: ['unpaid', 'partial'] }, dueDate: { $lt: now } },
      { status: 'overdue' }
    ).catch(() => {}); // never block the list response

    const invoices = await Invoice.find(query)
      .select('-signatures.authorizer.data -signatures.seal.data')
      .populate('client', 'name email')
      .populate('project', 'title')
      .populate('branch', 'name')
      .populate('quotationRef', 'quotationNo')
      .populate('bankAccount', 'bankName accountNumber branchName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) { next(err); }
};



// ─── GET single invoice ───────────────────────────────────────────────────────
exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate(POPULATE_INVOICE);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
};

// ─── CREATE invoice (manual or from quotation) ────────────────────────────────
exports.createInvoice = async (req, res, next) => {
  try {
    const {
      client, project, quotationRef, branch, dueDate, invoiceDate,
      items = [], taxRate = 0, notes, paymentTerms, invoicePrefix, currency,
      exchangeRateToLKR,
    } = req.body;

    let sourceItems = items;
    let quotationData = {};
    let quotationDoc = null;

    if (quotationRef) {
      quotationDoc = await Quotation.findById(quotationRef);
      if (quotationDoc) {
        sourceItems = quotationDoc.items;
        quotationData = { quotationRef: quotationDoc._id };
      }
    }

    const effectiveTaxRate = quotationDoc ? (quotationDoc.taxRate || 0) : Number(taxRate || 0);
    const globalDiscountVal = quotationDoc ? (quotationDoc.globalDiscountValue || 0) : Number(req.body.globalDiscountValue || 0);
    const globalDiscountType = quotationDoc ? (quotationDoc.globalDiscountType || 'fixed') : (req.body.globalDiscountType || 'fixed');
    const transportCharge = Number(req.body.transportCharge) || (quotationDoc ? Number(quotationDoc.transportCharge || 0) : 0);
    const { items: calcedItems, subtotal, discountTotal, tax, total: baseTotal } = calcItems(sourceItems, effectiveTaxRate, globalDiscountVal, globalDiscountType);
    const total = parseFloat((baseTotal + transportCharge).toFixed(2));

    const resolvedCurrency = (currency || quotationDoc?.currency || 'LKR').toString().trim() || 'LKR';
    const resolvedFx = Number(exchangeRateToLKR) > 0
      ? Number(exchangeRateToLKR)
      : (resolvedCurrency === 'LKR' ? 1 : 1);

    let signaturesPayload = req.body.signatures;
    if (quotationDoc) {
      const siteSettings = await SiteSetting.findOne().lean().catch(() => null);
      const roleProfile = siteSettings?.signatures?.[quotationDoc.directorRole] || null;
      const qSealData = quotationDoc.showSeal !== false
        ? (quotationDoc.directorSealUrl || roleProfile?.url || siteSettings?.sealUrl || '')
        : '';
      const qAuthorizerName = quotationDoc.directorName || roleProfile?.label || siteSettings?.quotationDirectorName || '';
      const qAuthorizerTitle = quotationDoc.directorRole
        ? (quotationDoc.directorRole.charAt(0).toUpperCase() + quotationDoc.directorRole.slice(1))
        : 'Authorized Signatory';
      if (!signaturesPayload || (!signaturesPayload.seal?.data && !signaturesPayload.authorizer?.name)) {
        signaturesPayload = {
          authorizer: {
            data: signaturesPayload?.authorizer?.data || '',
            name: signaturesPayload?.authorizer?.name || qAuthorizerName,
            title: signaturesPayload?.authorizer?.title || qAuthorizerTitle,
          },
          seal: {
            data: signaturesPayload?.seal?.data || qSealData,
            note: signaturesPayload?.seal?.note || '',
          },
        };
      }
    }

    const invoicePayload = {
      client,
      project: project || undefined,
      ...quotationData,
      branch: (branch || (quotationDoc && quotationDoc.branch)) || undefined,
      invoiceDate: invoiceDate || new Date(),
      dueDate: dueDate || (quotationDoc && quotationDoc.validUntil) || undefined,
      items: calcedItems,
      subtotal,
      globalDiscountType,
      globalDiscountValue: globalDiscountVal,
      discountTotal,
      tax,
      taxRate: Number(effectiveTaxRate),
      total,
      currency: resolvedCurrency,
      exchangeRateToLKR: resolvedFx,
      serviceType: req.body.serviceType || (quotationDoc && quotationDoc.serviceType) || 'Other',
      transportCharge,
      paymentMethod: req.body.paymentMethod || (quotationDoc && quotationDoc.paymentMethod) || '',
      paymentMethodCustom: req.body.paymentMethodCustom || (quotationDoc && quotationDoc.paymentMethodCustom) || '',
      bankAccount: req.body.bankAccount || (quotationDoc && quotationDoc.bankAccount) || undefined,
      bankBranch: req.body.bankBranch || (quotationDoc && quotationDoc.bankBranch) || '',
      notes: notes || (quotationDoc && quotationDoc.notes) || '',
      paymentTerms: paymentTerms || req.body.terms || (quotationDoc && quotationDoc.terms) || '',
      terms: req.body.terms || paymentTerms || (quotationDoc && quotationDoc.terms) || '',
      invoicePrefix: invoicePrefix || 'INV',
      status: 'unpaid',
      signatures: signaturesPayload || undefined,
      createdBy: req.user._id,
    };
    
    const explicitNo = req.body.invoiceNo != null ? String(req.body.invoiceNo).trim() : '';
    if (explicitNo) {
      invoicePayload.invoiceNo = explicitNo;
    } else {
      invoicePayload.invoiceNo = await generateAutoInvoiceNo(invoicePayload.invoicePrefix || 'INV');
    }

    const invoice = await Invoice.create(invoicePayload);

    if (quotationRef && quotationDoc) {
      await Quotation.findByIdAndUpdate(quotationRef, { status: 'converted', convertedToInvoice: invoice._id });
    }

    await createNotification({
      recipient: invoice.client,
      title: 'New Invoice',
      message: `Invoice ${invoice.invoiceNo} for ${invoice.currency} ${total.toLocaleString()} has been issued. Due: ${dueDate ? new Date(dueDate).toLocaleDateString('en-LK') : 'N/A'}.`,
      type: 'payment',
      link: '/invoices',
    });

    const populatedInv = await Invoice.findById(invoice._id).populate('client');
    if (populatedInv.client?.email) {
      const { sendInvoiceEmail } = require('../services/emailService');
      await sendInvoiceEmail(populatedInv.client.email, populatedInv.client.name, invoice);
    }
    if (populatedInv.client?.phone) {
      const { sendInvoiceSms } = require('../services/smsService');
      await sendInvoiceSms(populatedInv.client.phone, populatedInv.client.name, invoice.invoiceNo, invoice.total, dueDate || invoiceDate, invoice._id);
    }

    await syncProjectsForInvoice(invoice._id);

    const populated = await Invoice.findById(invoice._id).populate(POPULATE_INVOICE);
    res.status(201).json({ success: true, invoice: populated || invoice });
  } catch (err) { next(err); }
};

// ─── UPDATE invoice (items / dates / meta) ────────────────────────────────────
exports.updateInvoice = async (req, res, next) => {
  try {
    const existing = await Invoice.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

    const {
      items, taxRate, notes, paymentTerms, dueDate, invoiceDate,
      client, project, branch, quotationRef, currency, exchangeRateToLKR, status, signatures
    } = req.body;

    const wantsLineEdit = items !== undefined && items !== null;
    const wantsFinancialEdit = wantsLineEdit || taxRate !== undefined;

    // Fully paid: allow status + metadata corrections; block line items / tax changes (would desync payments).
    if (existing.status === 'paid' && wantsFinancialEdit) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change line items or tax on a fully paid invoice. Adjust payments or change status first.',
      });
    }

    if (existing.status === 'paid') {
      const fx = exchangeRateToLKR !== undefined
        ? (Number(exchangeRateToLKR) > 0 ? Number(exchangeRateToLKR) : 1)
        : (existing.exchangeRateToLKR != null ? existing.exchangeRateToLKR : 1);
      const paidMeta = {
        ...(notes !== undefined ? { notes } : {}),
        ...(paymentTerms !== undefined ? { paymentTerms } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(exchangeRateToLKR !== undefined ? { exchangeRateToLKR: fx } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate || existing.dueDate } : {}),
        ...(invoiceDate !== undefined ? { invoiceDate: invoiceDate || existing.invoiceDate } : {}),
        ...(branch !== undefined ? { branch: branch || null } : {}),
        ...(project !== undefined ? { project: project || null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(signatures !== undefined ? { signatures } : {}),
        ...(req.body.serviceType !== undefined ? { serviceType: req.body.serviceType } : {}),
        ...(req.body.transportCharge !== undefined ? { transportCharge: Number(req.body.transportCharge) } : {}),
        ...(req.body.paymentMethod !== undefined ? { paymentMethod: req.body.paymentMethod } : {}),
        ...(req.body.paymentMethodCustom !== undefined ? { paymentMethodCustom: req.body.paymentMethodCustom } : {}),
        ...(req.body.bankAccount !== undefined ? { bankAccount: req.body.bankAccount } : {}),
        ...(req.body.bankBranch !== undefined ? { bankBranch: req.body.bankBranch } : {}),
        ...(req.body.terms !== undefined ? { terms: req.body.terms } : {}),
      };
      if (status !== undefined && status !== existing.status) {
        await createAuditLog({
          user: req.user,
          action: 'update',
          module: 'invoices',
          entityId: existing._id,
          entityName: existing.invoiceNo,
          description: `Invoice status changed from "${existing.status}" to "${status}"`,
        });
      }
      const invoice = await Invoice.findByIdAndUpdate(req.params.id, { $set: paidMeta }, { new: true, runValidators: true })
        .populate(POPULATE_INVOICE);
      await syncProjectsForInvoice(invoice._id);
      const refreshed = await Invoice.findById(invoice._id).populate(POPULATE_INVOICE);
      return res.json({ success: true, invoice: refreshed });
    }

    let updates = {
      ...(notes !== undefined && { notes }),
      ...(paymentTerms !== undefined && { paymentTerms }),
      ...(currency !== undefined && { currency }),
      exchangeRateToLKR: exchangeRateToLKR !== undefined
        ? (Number(exchangeRateToLKR) > 0 ? Number(exchangeRateToLKR) : 1)
        : (existing.exchangeRateToLKR != null ? existing.exchangeRateToLKR : 1),
      dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
      invoiceDate: invoiceDate !== undefined ? invoiceDate : existing.invoiceDate,
      client: client !== undefined ? client : existing.client,
      project: project !== undefined ? (project || null) : existing.project,
      branch: branch !== undefined ? (branch || null) : existing.branch,
      quotationRef: quotationRef !== undefined ? (quotationRef || null) : existing.quotationRef,
      ...(signatures !== undefined ? { signatures } : {}),
      ...(req.body.serviceType !== undefined ? { serviceType: req.body.serviceType } : {}),
      ...(req.body.transportCharge !== undefined ? { transportCharge: Number(req.body.transportCharge) } : {}),
      ...(req.body.paymentMethod !== undefined ? { paymentMethod: req.body.paymentMethod } : {}),
      ...(req.body.paymentMethodCustom !== undefined ? { paymentMethodCustom: req.body.paymentMethodCustom } : {}),
      ...(req.body.bankAccount !== undefined ? { bankAccount: req.body.bankAccount } : {}),
      ...(req.body.bankBranch !== undefined ? { bankBranch: req.body.bankBranch } : {}),
      ...(req.body.terms !== undefined ? { terms: req.body.terms } : {}),
    };

    if (items) {
      const globalDiscountType = req.body.globalDiscountType !== undefined ? req.body.globalDiscountType : (existing.globalDiscountType || 'fixed');
      const globalDiscountVal = req.body.globalDiscountValue !== undefined ? Number(req.body.globalDiscountValue) : (existing.globalDiscountValue || 0);
      const transportCharge = req.body.transportCharge !== undefined
        ? Number(req.body.transportCharge)
        : Number(existing.transportCharge || 0);
      const { items: calcedItems, subtotal, discountTotal, tax, total: baseTotal } = calcItems(items, taxRate ?? existing.taxRate, globalDiscountVal, globalDiscountType);
      const total = parseFloat((baseTotal + transportCharge).toFixed(2));
      updates = { ...updates, items: calcedItems, subtotal, globalDiscountType, globalDiscountValue: globalDiscountVal, discountTotal, tax, taxRate: Number(taxRate ?? existing.taxRate), transportCharge, total };
    }

    if (status !== undefined && status !== existing.status) {
      updates.status = status;
      if (status === 'cancelled') {
        updates.paidAt = null;
      }
      await createAuditLog({
        user: req.user,
        action: 'update',
        module: 'invoices',
        entityId: existing._id,
        entityName: existing.invoiceNo,
        description: `Invoice status changed from "${existing.status}" to "${status}"`,
      });
    } else if (status !== undefined) {
      updates.status = status;
    }

    const invoice = await Invoice.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate(POPULATE_INVOICE);

    await syncProjectsForInvoice(invoice._id);
    const refreshed = await Invoice.findById(invoice._id).populate(POPULATE_INVOICE);
    res.json({ success: true, invoice: refreshed });
  } catch (err) { next(err); }
};

// ─── RECORD PAYMENT (partial or full) ─────────────────────────────────────────
exports.recordPayment = async (req, res, next) => {
  try {
    const { amount, date, method, reference, notes } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.remainingBalance <= 0) return res.status(400).json({ success: false, message: 'Invoice already fully paid' });

    const payAmt = Math.min(Number(amount), invoice.remainingBalance);
    const bankAccount = req.body.bankAccount;
    
    invoice.payments.push({
      amount: payAmt, date: date || new Date(),
      method: method || 'cash', reference, notes, bankAccount,
      recordedBy: req.user._id, isAdvance: false,
    });
    await invoice.save(); // triggers pre-save for totals + status

    const lastPayment = invoice.payments[invoice.payments.length - 1];
    await logInvoicePaymentIncome({
      invoice,
      amount: payAmt,
      date: lastPayment?.date || date,
      createdBy: req.user._id,
      isAdvance: false,
      method: method || 'cash',
      reference,
      notes,
      bankAccount,
    });

    if (bankAccount && isLedgerBankMethod(method)) {
      await appendBankTransaction(bankAccount, {
        type: 'deposit',
        amount: payAmt,
        description: `Invoice Payment: ${invoice.invoiceNo}`,
        date: date || new Date(),
        reference: reference || '',
        recordedBy: req.user._id,
        moduleSource: 'invoices',
      });
    }

    // Notify client
    await createNotification({
      recipient: invoice.client,
      title: invoice.remainingBalance === 0 ? 'Invoice Fully Paid ✅' : 'Payment Received',
      message: invoice.remainingBalance === 0
        ? `Invoice ${invoice.invoiceNo} has been fully paid. Thank you!`
        : `Payment of LKR ${payAmt.toLocaleString()} recorded. Remaining: LKR ${invoice.remainingBalance.toLocaleString()}.`,
      type: 'payment',
      link: '/invoices',
    });

    if (invoice.status === 'paid') {
      await awardPoints({ userId: invoice.client, action: 'complete_invoice_payment', sourceKey: `inv-paid:${invoice._id}`, note: 'Invoice paid' });
    }

    await syncProjectsForInvoice(invoice._id);

    const populated = await Invoice.findById(invoice._id).populate(POPULATE_INVOICE);
    res.json({ success: true, invoice: populated });
  } catch (err) { next(err); }
};

// ─── RECORD ADVANCE payment ───────────────────────────────────────────────────
exports.recordAdvance = async (req, res, next) => {
  try {
    const { amount, date, method, reference, notes } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const bankAccount = req.body.bankAccount;
    const payAmt = Number(amount);

    invoice.payments.push({
      amount: payAmt, date: date || new Date(),
      method: method || 'cash', reference, notes,
      bankAccount: bankAccount || undefined,
      recordedBy: req.user._id, isAdvance: true,
    });
    await invoice.save();

    const lastAdvance = invoice.payments[invoice.payments.length - 1];
    await logInvoicePaymentIncome({
      invoice,
      amount: payAmt,
      date: lastAdvance?.date || date,
      createdBy: req.user._id,
      isAdvance: true,
      method: method || 'cash',
      reference,
      notes,
      bankAccount,
    });

    if (bankAccount && isLedgerBankMethod(method)) {
      await appendBankTransaction(bankAccount, {
        type: 'deposit',
        amount: payAmt,
        description: `Invoice Advance: ${invoice.invoiceNo}`,
        date: date || new Date(),
        reference: reference || '',
        recordedBy: req.user._id,
        moduleSource: 'invoices',
      });
    }

    await createNotification({
      recipient: invoice.client,
      title: 'Advance Payment Recorded',
      message: `Advance payment of LKR ${Number(amount).toLocaleString()} recorded against invoice ${invoice.invoiceNo}.`,
      type: 'payment',
      link: '/invoices',
    });

    await syncProjectsForInvoice(invoice._id);

    const populated = await Invoice.findById(invoice._id).populate(POPULATE_INVOICE);
    res.json({ success: true, invoice: populated });
  } catch (err) { next(err); }
};

// ─── DELETE invoice ───────────────────────────────────────────────────────────
// Paid / unpaid: always allowed (admin). No "cannot delete paid" guard.
exports.deleteInvoice = async (req, res, next) => {
  try {
    const pwCheck = await verifyActionPassword(req.user._id, req.body?.password);
    if (!pwCheck.ok) return res.status(pwCheck.status).json({ success: false, message: pwCheck.message });

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Not found' });

    const snapshot = {
      invoiceNo: invoice.invoiceNo,
      total: invoice.total,
      status: invoice.status,
      client: invoice.client,
      paymentsCount: (invoice.payments || []).length,
    };

    for (const p of invoice.payments || []) {
      if (p.bankAccount && isLedgerBankMethod(p.method)) {
        await appendBankTransaction(p.bankAccount, {
          type: 'withdrawal',
          amount: p.amount,
          description: `Reversal: deleted invoice ${invoice.invoiceNo}`,
          date: new Date(),
          reference: `del-inv-${invoice._id}`,
          moduleSource: 'invoices',
          sourceType: 'invoice_delete',
          sourceId: invoice._id,
          recordedBy: req.user._id,
          paymentMethod: p.method,
        });
      }
    }

    await deleteInvoiceFinanceEntries(invoice.invoiceNo);

    await Payment.deleteMany({ invoice: invoice._id });
    await Project.updateMany(
      { $or: [{ invoice: invoice._id }, { linkedInvoices: invoice._id }] },
      { $pull: { linkedInvoices: invoice._id }, $unset: { invoice: '' }, $set: { paymentStatus: 'none' } },
    );

    if (invoice.quotationRef) {
      await Quotation.findByIdAndUpdate(invoice.quotationRef, {
        status: 'confirmed',
        $unset: { convertedToInvoice: 1 },
      });
    }

    await invoice.deleteOne();

    await createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'delete',
      module: 'invoices',
      entityId: String(req.params.id),
      entityName: snapshot.invoiceNo,
      description: `Deleted invoice ${snapshot.invoiceNo}`,
      changes: { before: snapshot, after: null },
      severity: 'critical',
    });

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (err) { next(err); }
};

// @desc    Send invoice (email / SMS / link / PDF)
// @route   POST /api/invoices/:id/send
exports.sendInvoice = async (req, res, next) => {
  try {
    const methods = Array.isArray(req.body.methods) ? req.body.methods : [];
    if (!methods.length) {
      return res.status(400).json({ success: false, message: 'Select at least one send method' });
    }

    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate('project', 'title')
      .populate('quotationRef', 'quotationNo')
      .populate('bankAccount', 'bankName accountNumber branchName');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const shareLink = `${clientUrl}/payments?invoice=${invoice._id}`;
    const results = { email: null, sms: null, link: null, pdf: null };
    const client = invoice.client;

    let pdfBuffer = null;
    if (methods.includes('email') || methods.includes('pdf')) {
      try {
        const { invoiceToPdf } = require('../services/documentPdfService');
        pdfBuffer = await invoiceToPdf(invoice);
        if (methods.includes('pdf')) results.pdf = 'ready';
      } catch (e) {
        console.error('[Invoice] PDF generation failed:', e.message);
        if (methods.includes('pdf')) results.pdf = 'failed';
      }
    }

    if (methods.includes('email')) {
      if (!client?.email) {
        results.email = 'skipped_no_email';
      } else {
        try {
          const { sendInvoiceEmail } = require('../services/emailService');
          await sendInvoiceEmail(client.email, client.name, invoice, { shareLink, pdfBuffer });
          results.email = 'sent';
        } catch (e) {
          results.email = 'failed';
        }
      }
    }

    if (methods.includes('sms')) {
      if (!client?.phone) {
        results.sms = 'skipped_no_phone';
      } else {
        try {
          const { sendSms } = require('../services/smsService');
          const msg = `Hi ${client.name}, invoice ${invoice.invoiceNo} for LKR ${Number(invoice.remainingBalance ?? invoice.total).toLocaleString()} is ready. View: ${shareLink}`;
          await sendSms(client.phone, msg, client.name, 'invoice');
          results.sms = 'sent';
        } catch (e) {
          results.sms = 'failed';
        }
      }
    }

    if (methods.includes('link')) results.link = shareLink;

    const parts = [];
    if (results.email === 'sent') parts.push('email sent');
    if (results.email === 'failed') parts.push('email failed');
    if (results.sms === 'sent') parts.push('SMS sent');
    if (results.sms === 'failed') parts.push('SMS failed');
    if (results.link) parts.push('link ready');
    if (results.pdf === 'ready') parts.push('PDF ready');

    res.json({
      success: true,
      shareLink,
      results,
      message: parts.length ? parts.join('; ') : 'Nothing sent',
    });
  } catch (err) { next(err); }
};

// @desc    Download invoice PDF
// @route   GET /api/invoices/:id/pdf
exports.downloadInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate('project', 'title')
      .populate('quotationRef', 'quotationNo')
      .populate('bankAccount', 'bankName accountNumber branchName');
    if (!invoice) return res.status(404).json({ success: false, message: 'Not found' });

    if (req.user.role === 'client') {
      const clientId = String(req.user.client || req.user._id);
      if (String(invoice.client?._id || invoice.client) !== clientId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { buildInvoiceDocumentHtml, bankLabelFromAccount, inlineUploadImagesInHtml } = require('../services/documentHtmlService');
    const bankLabel = bankLabelFromAccount(invoice.bankAccount);
    const html = await buildInvoiceDocumentHtml(invoice, { bankLabel });
    const inlinedHtml = inlineUploadImagesInHtml(html);

    if (req.query.html === 'true') {
      return res.send(inlinedHtml);
    }

    const { htmlToPdfBuffer } = require('../services/documentPdfService');
    const pdf = await htmlToPdfBuffer(inlinedHtml);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNo || 'invoice'}.pdf"`);
    res.send(pdf);
  } catch (err) { next(err); }
};

// ─── PayHere initiate ─────────────────────────────────────────────────────────
exports.initiatePayment = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    const invoice = await Invoice.findById(invoiceId).populate('client', 'name email phone');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const secret     = process.env.PAYHERE_SECRET;
    const orderId    = `RXW-${invoice.invoiceNo}-${Date.now()}`;
    const amount     = (invoice.remainingBalance || invoice.total).toFixed(2);
    const currency   = invoice.currency || 'LKR';

    const secretHash = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const hash = crypto.createHash('md5')
      .update(`${merchantId}${orderId}${amount}${currency}${secretHash}`)
      .digest('hex').toUpperCase();

    const payment = await Payment.create({
      invoice: invoiceId, client: req.user._id,
      amount: Number(amount), currency, payhere_order_id: orderId,
    });

    res.json({
      success: true,
      paymentData: {
        merchant_id: merchantId,
        return_url: `${process.env.CLIENT_URL}/client/payments/success`,
        cancel_url:  `${process.env.CLIENT_URL}/client/payments/cancel`,
        notify_url:  `${process.env.SERVER_URL}/api/payments/payhere/callback`,
        order_id: orderId, items: invoice.items.map(i => i.description).join(', '),
        amount, currency,
        first_name: invoice.client.name.split(' ')[0],
        last_name:  invoice.client.name.split(' ').slice(1).join(' ') || 'N/A',
        email:    invoice.client.email,
        phone:    invoice.client.phone || '0000000000',
        address:  'Colombo', city: 'Colombo', country: 'Sri Lanka',
        hash, sandbox: process.env.PAYHERE_SANDBOX === 'true', paymentId: payment._id,
      }
    });
  } catch (err) { next(err); }
};

// ─── PayHere callback ─────────────────────────────────────────────────────────
exports.payhereCallback = async (req, res, next) => {
  try {
    const { merchant_id, order_id, payment_id, payhere_amount, payhere_currency, status_code, md5sig } = req.body;
    const secretHash = crypto.createHash('md5').update(process.env.PAYHERE_SECRET).digest('hex').toUpperCase();
    const localSig   = crypto.createHash('md5')
      .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`)
      .digest('hex').toUpperCase();
    if (localSig !== md5sig) return res.status(400).send('Invalid signature');

    const payment = await Payment.findOne({ payhere_order_id: order_id });
    if (payment) {
      payment.payhere_payment_id  = payment_id;
      payment.payhere_status_code = status_code;
      payment.md5sig = md5sig;
      payment.status = status_code === '2' ? 'completed' : status_code === '0' ? 'pending' : 'failed';
      if (status_code === '2') {
        payment.paidAt = new Date();
        const inv = await Invoice.findById(payment.invoice);
        if (inv) {
          inv.payments.push({
            amount: Number(payhere_amount), date: new Date(),
            method: 'payhere', reference: payment_id, isAdvance: false,
          });
          await inv.save();
          await syncProjectsForInvoice(inv._id);
        }
      }
      await payment.save();
    }
    res.send('OK');
  } catch (err) { next(err); }
};

// ─── Payment history ──────────────────────────────────────────────────────────
exports.calcItems = calcItems;

exports.getPaymentHistory = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'client') query.client = req.user._id;
    const payments = await Payment.find(query)
      .populate('invoice', 'invoiceNo total')
      .populate('client', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (err) { next(err); }
};
