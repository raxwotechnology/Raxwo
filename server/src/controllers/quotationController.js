const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Project = require('../models/Project');
const Branch = require('../models/Branch');
const BankAccount = require('../models/BankAccount');
const SiteSetting = require('../models/SiteSetting');
const { createAuditLog } = require('./auditController');
const { createNotification } = require('../services/notificationService');
const { generateAutoInvoiceNo } = require('../utils/allocateInvoiceNoFromQuotation');
const { verifyActionPassword } = require('../utils/actionPassword');
const { calcItems } = require('./invoiceController');

function calcQuotationTotals(validItems, taxRate = 0, transportCharge = 0, globalDiscountValue = 0, globalDiscountType = 'fixed') {
  const { subtotal, discountTotal, tax, total: baseTotal, items } = calcItems(
    validItems,
    taxRate,
    globalDiscountValue,
    globalDiscountType,
  );
  const transport = Number(transportCharge || 0);
  return {
    items,
    subtotal,
    discountTotal,
    tax,
    transportCharge: transport,
    total: parseFloat((baseTotal + transport).toFixed(2)),
  };
}

function quotationAuditSummary(doc) {
  if (!doc) return null;
  const items = doc.items || [];
  return {
    quotationNo: doc.quotationNo,
    title: doc.title,
    status: doc.status,
    total: doc.total,
    subtotal: doc.subtotal,
    itemCount: Array.isArray(items) ? items.length : 0,
    taxRate: doc.taxRate,
    serviceType: doc.serviceType,
  };
}

// @desc    Get all quotations
// @route   GET /api/quotations
exports.getQuotations = async (req, res, next) => {
  try {
    const { status, client, startDate, endDate, serviceType, branch } = req.query;
    const query = {};
    if (status) query.status = status;
    if (serviceType) query.serviceType = serviceType;
    if (branch) query.branch = branch;
    if (req.user.role === 'client') {
      const clientIds = [req.user._id, req.user.client].filter(Boolean);
      query.client = { $in: clientIds };
    } else if (client) {
      query.client = client;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    const quotations = await Quotation.find(query)
      .sort({ createdAt: -1 })
      .select('-statusLog -notes -terms -directorSealUrl')
      .populate('client', 'name email phone companyName')
      .populate('booking', 'projectTitle')
      .populate('generatedBy', 'name')
      .populate('branch', 'name')
      .populate('project', 'title deadline')
      .populate('bankAccount', 'bankName accountNumber branchName')
      .limit(200)
      .maxTimeMS(10000)
      .lean();
    res.json({ success: true, count: quotations.length, quotations });
  } catch (err) { next(err); }
};

// @desc    Get single quotation
// @route   GET /api/quotations/:id
exports.getQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('client', 'name email phone companyName')
      .populate('generatedBy', 'name')
      .populate('confirmedBy', 'name')
      .populate('bankAccount', 'bankName accountNumber branchName')
      .populate('convertedToInvoice', 'invoiceNo total status')
      .lean();
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (req.user.role === 'client') {
      const clientId = String(req.user.client || req.user._id);
      if (String(quotation.client?._id || quotation.client) !== clientId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }
    res.json({ success: true, quotation });
  } catch (err) { next(err); }
};

// @desc    Create quotation
// @route   POST /api/quotations
exports.createQuotation = async (req, res, next) => {
  try {
    const { client, items = [] } = req.body;
    if (!client) {
      return res.status(400).json({ success: false, message: 'Client is required' });
    }
    const validItems = (Array.isArray(items) ? items : [])
      .map((item) => ({
        ...item,
        description: String(item.description || '').trim(),
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        discount: Number(item.discount || 0),
        total: Number(item.total || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0) * (1 - Number(item.discount || 0) / 100),
      }))
      .filter((item) => item.description);
    if (validItems.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item with a description is required' });
    }

    const taxRate = Number(req.body.taxRate || 0);
    const transportCharge = Number(req.body.transportCharge || 0);
    const globalDiscountType = req.body.globalDiscountType || 'fixed';
    const globalDiscountValue = Number(req.body.globalDiscountValue || 0);
    const totals = calcQuotationTotals(validItems, taxRate, transportCharge, globalDiscountValue, globalDiscountType);
    const { subtotal, discountTotal, tax, total } = totals;
    const role = String(req.body.directorRole || '').trim()
    const settings = await SiteSetting.findOne().lean()
    const roleSeal = settings?.sealUrl || ''
    const roleLabel = settings?.signatures?.[role]?.label || ''
    const payload = {
      ...req.body,
      items: totals.items || validItems,
      subtotal,
      discountTotal,
      globalDiscountType,
      globalDiscountValue,
      tax,
      taxRate,
      transportCharge,
      total,
      generatedBy: req.user._id,
      preparedBy: String(req.body.preparedBy || '').trim() || req.user.name || '',
      notes: String(req.body.notes || '').trim(),
      terms: String(req.body.terms || '').trim(),
      bankBranch: String(req.body.bankBranch || '').trim(),
      directorRole: role,
      directorName: String(req.body.directorName || '').trim() || roleLabel || '',
      directorSealUrl: String(req.body.directorSealUrl || '').trim() || roleSeal || settings?.sealUrl || '',
    };
    if (!payload.title) payload.title = 'Quotation';
    if (!payload.branch) delete payload.branch;
    if (!payload.project) delete payload.project;

    const quotation = await Quotation.create(payload);
    await createAuditLog({
      user: req.user,
      action: 'create',
      module: 'quotations',
      entityId: quotation._id,
      entityName: quotation.quotationNo,
      description: `Quotation ${quotation.quotationNo} created`,
      changes: { before: null, after: quotationAuditSummary(quotation.toObject()) },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
    if (quotation.client) {
      await createNotification({
        recipient: quotation.client,
        title: 'New Quotation',
        message: `A new quotation (${quotation.quotationNo}) has been generated for you.`,
        type: 'financial',
        link: `/my-account`
      });

      const populatedQ = await Quotation.findById(quotation._id).populate('client');
      if (populatedQ.client?.email) {
        const { sendQuotationEmail } = require('../services/emailService');
        await sendQuotationEmail(populatedQ.client.email, populatedQ.client.name, quotation);
      }
      if (populatedQ.client?.phone) {
        const { sendQuotationSms } = require('../services/smsService');
        await sendQuotationSms(populatedQ.client.phone, populatedQ.client.name, quotation.quotationNo, quotation.total, quotation._id);
      }
    }

    const populatedOut = await Quotation.findById(quotation._id)
      .populate('client', 'name email phone')
      .populate('generatedBy', 'name')
      .populate('bankAccount', 'bankName accountNumber branchName');
    res.status(201).json({ success: true, quotation: populatedOut || quotation });
  } catch (err) { next(err); }
};

// @desc    Update quotation
// @route   PUT /api/quotations/:id
exports.updateQuotation = async (req, res, next) => {
  try {
    const prev = await Quotation.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const allowed = ['draft', 'sent', 'accepted', 'confirmed', 'rejected', 'expired', 'converted'];
    const updates = { ...req.body };
    if (updates.notes != null) updates.notes = String(updates.notes || '').trim()
    if (updates.terms != null) updates.terms = String(updates.terms || '').trim()
    if (updates.bankBranch != null) updates.bankBranch = String(updates.bankBranch || '').trim()
    if (updates.directorRole != null) updates.directorRole = String(updates.directorRole || '').trim()
    if (updates.directorName != null) updates.directorName = String(updates.directorName || '').trim()
    if (updates.directorSealUrl != null) updates.directorSealUrl = String(updates.directorSealUrl || '').trim()
    if (updates.directorRole && !updates.directorSealUrl) {
      const settings = await SiteSetting.findOne().lean()
      updates.directorSealUrl = settings?.sealUrl || ''
      if (!updates.directorName) {
        updates.directorName = settings?.signatures?.[updates.directorRole]?.label || settings?.quotationDirectorName || ''
      }
    }
    if (updates.status && !allowed.includes(updates.status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const quotation = await Quotation.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    await createAuditLog({
      user: req.user,
      action: 'update',
      module: 'quotations',
      entityId: quotation._id,
      entityName: quotation.quotationNo,
      description: `Quotation ${quotation.quotationNo} updated (status: ${quotation.status})`,
      changes: { before: quotationAuditSummary(prev), after: quotationAuditSummary(quotation.toObject()) },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
    const populatedOut = await Quotation.findById(quotation._id)
      .populate('client', 'name email phone')
      .populate('generatedBy', 'name')
      .populate('bankAccount', 'bankName accountNumber branchName');
    res.json({ success: true, quotation: populatedOut || quotation });
  } catch (err) { next(err); }
};

// @desc    Confirm quotation
// @route   PUT /api/quotations/:id/confirm
exports.confirmQuotation = async (req, res, next) => {
  try {
    const prev = await Quotation.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      { status: 'confirmed', confirmedAt: new Date(), confirmedBy: req.user._id },
      { new: true }
    ).populate('client', 'name email');
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    await createAuditLog({
      user: req.user,
      action: 'approve',
      module: 'quotations',
      entityId: quotation._id,
      entityName: quotation.quotationNo,
      description: `Quotation ${quotation.quotationNo} confirmed`,
      changes: { before: quotationAuditSummary(prev), after: quotationAuditSummary(quotation.toObject()) },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
    res.json({ success: true, quotation });
  } catch (err) { next(err); }
};

// @desc    Convert quotation to invoice
// @route   POST /api/quotations/:id/convert-to-invoice
exports.convertToInvoice = async (req, res, next) => {
  try {
    const qLean = await Quotation.findById(req.params.id).select('quotationNo status convertedToInvoice').lean();
    if (!qLean) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (qLean.status === 'converted' || qLean.convertedToInvoice) {
      return res.status(400).json({ success: false, message: 'Already converted to invoice' });
    }

    const quotation = await Quotation.findById(req.params.id).populate('client', 'name email');
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const quoteNo = qLean.quotationNo != null ? String(qLean.quotationNo).trim() : '';
    if (!quoteNo) {
      return res.status(400).json({
        success: false,
        message: 'This quotation has no quotation number in the database. Save the quotation again, then convert.',
      });
    }

    const sourceItems = (quotation.items || []).map((item) => {
      const raw = item && typeof item.toObject === 'function' ? item.toObject() : { ...item };
      return { ...raw };
    });
    const globalDiscountType = quotation.globalDiscountType || 'fixed';
    const globalDiscountValue = Number(quotation.globalDiscountValue || 0);
    const transportCharge = Number(quotation.transportCharge || 0);
    const { items: calcedItems, subtotal, discountTotal, tax, total: baseTotal } = calcItems(
      sourceItems,
      quotation.taxRate || 0,
      globalDiscountValue,
      globalDiscountType,
    );
    const invTotal = parseFloat((baseTotal + transportCharge).toFixed(2));

    const invNo = await generateAutoInvoiceNo('INV');

    const siteSettings = await SiteSetting.findOne().lean().catch(() => null);
    const roleProfile = siteSettings?.signatures?.[quotation.directorRole] || null;
    const qSealData = quotation.showSeal !== false
      ? (quotation.directorSealUrl || roleProfile?.url || siteSettings?.sealUrl || '')
      : '';
    const qAuthorizerName = quotation.directorName || roleProfile?.label || siteSettings?.quotationDirectorName || '';
    const qAuthorizerTitle = quotation.directorRole
      ? (quotation.directorRole.charAt(0).toUpperCase() + quotation.directorRole.slice(1))
      : 'Authorized Signatory';

    const clientId = quotation.client?._id || quotation.client;
    const invoice = new Invoice({
      client: clientId,
      quotationRef: quotation._id,
      invoiceNo: invNo,
      items: calcedItems,
      subtotal,
      globalDiscountType,
      globalDiscountValue,
      discountTotal,
      tax,
      taxRate: quotation.taxRate,
      total: invTotal,
      currency: quotation.currency,
      exchangeRateToLKR: quotation.exchangeRateToLKR || 1,
      notes: quotation.notes,
      terms: quotation.terms,
      paymentTerms: quotation.terms,
      serviceType: quotation.serviceType || 'Other',
      transportCharge,
      paymentMethod: quotation.paymentMethod || '',
      paymentMethodCustom: quotation.paymentMethodCustom || '',
      bankAccount: quotation.bankAccount,
      bankBranch: quotation.bankBranch || '',
      branch: quotation.branch,
      dueDate: quotation.validUntil || undefined,
      status: 'unpaid',
      signatures: {
        authorizer: {
          data: '',
          name: qAuthorizerName,
          title: qAuthorizerTitle,
        },
        seal: {
          data: qSealData,
          note: '',
        },
      },
      createdBy: req.user._id,
    });
    await invoice.save();

    await Quotation.findByIdAndUpdate(quotation._id, { status: 'converted', convertedToInvoice: invoice._id });
    await createAuditLog({
      user: req.user,
      action: 'create',
      module: 'quotations',
      entityId: quotation._id,
      entityName: quotation.quotationNo,
      description: `Quotation ${quotation.quotationNo} converted to invoice ${invoice.invoiceNo}`,
      changes: {
        before: quotationAuditSummary(quotation.toObject()),
        after: { status: 'converted', invoiceNo: invoice.invoiceNo, invoiceId: String(invoice._id) },
      },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    const populated = await Invoice.findById(invoice._id).populate('client', 'name email').populate('quotationRef', 'quotationNo title');
    res.json({ success: true, invoice: populated, quotation });
  } catch (err) { next(err); }
};

// @desc    Send quotation (email / SMS / share link)
// @route   POST /api/quotations/:id/send
exports.sendQuotation = async (req, res, next) => {
  try {
    const methods = Array.isArray(req.body.methods) ? req.body.methods : [];
    if (!methods.length) {
      return res.status(400).json({ success: false, message: 'Select at least one send method' });
    }

    const quotation = await Quotation.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate('generatedBy', 'name')
      .populate('bankAccount', 'bankName accountNumber branchName');
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const shareLink = `${clientUrl}/my-account?quotation=${quotation._id}`;
    const results = { email: null, sms: null, link: null, pdf: null };
    const client = quotation.client;

    let pdfBuffer = null;
    if (methods.includes('email') || methods.includes('pdf')) {
      try {
        const { quotationToPdf } = require('../services/documentPdfService');
        pdfBuffer = await quotationToPdf(quotation);
        if (methods.includes('pdf')) results.pdf = 'ready';
      } catch (e) {
        console.error('[Quotation] PDF generation failed:', e.message);
        if (methods.includes('pdf')) results.pdf = 'failed';
      }
    }

    if (methods.includes('email')) {
      if (!client?.email) {
        results.email = 'skipped_no_email';
      } else {
        try {
          const { sendQuotationEmail } = require('../services/emailService');
          await sendQuotationEmail(client.email, client.name, quotation, { shareLink, pdfBuffer });
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
          const { sendQuotationLinkSms } = require('../services/smsService');
          await sendQuotationLinkSms(client.phone, client.name, quotation.quotationNo, shareLink);
          results.sms = 'sent';
        } catch (e) {
          results.sms = 'failed';
        }
      }
    }

    if (methods.includes('link')) {
      results.link = shareLink;
    }

    if (quotation.status === 'draft' && (results.email === 'sent' || results.sms === 'sent')) {
      quotation.status = 'sent';
      quotation.sentAt = new Date();
      await quotation.save();
    }

    const parts = [];
    if (results.email === 'sent') parts.push('email sent');
    if (results.email === 'failed') parts.push('email failed');
    if (results.sms === 'sent') parts.push('SMS sent');
    if (results.sms === 'failed') parts.push('SMS failed');
    if (results.link) parts.push('link ready');

    res.json({
      success: true,
      shareLink,
      results,
      message: parts.length ? parts.join('; ') : 'Nothing sent — check client contact details',
    });
  } catch (err) { next(err); }
};

// @desc    Download quotation PDF
// @route   GET /api/quotations/:id/pdf
exports.downloadQuotationPdf = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate('generatedBy', 'name')
      .populate('bankAccount', 'bankName accountNumber branchName');
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    if (req.user.role === 'client') {
      const clientId = String(req.user.client || req.user._id);
      if (String(quotation.client?._id || quotation.client) !== clientId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { buildQuotationDocumentHtml, bankLabelFromAccount, inlineUploadImagesInHtml } = require('../services/documentHtmlService');
    const bankLabel = bankLabelFromAccount(quotation.bankAccount);
    const html = await buildQuotationDocumentHtml(quotation, { bankLabel });
    const inlinedHtml = inlineUploadImagesInHtml(html);

    if (req.query.html === 'true') {
      return res.send(inlinedHtml);
    }

    const { htmlToPdfBuffer } = require('../services/documentPdfService');
    const pdf = await htmlToPdfBuffer(inlinedHtml);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quotation.quotationNo || 'quotation'}.pdf"`);
    res.send(pdf);
  } catch (err) { next(err); }
};

// @desc    Delete quotation
// @route   DELETE /api/quotations/:id
exports.deleteQuotation = async (req, res, next) => {
  try {
    const pwCheck = await verifyActionPassword(req.user._id, req.body?.password);
    if (!pwCheck.ok) return res.status(pwCheck.status).json({ success: false, message: pwCheck.message });

    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    await createAuditLog({
      user: req.user,
      action: 'delete',
      module: 'quotations',
      entityId: quotation._id,
      entityName: quotation.quotationNo,
      description: `Quotation ${quotation.quotationNo} deleted`,
      changes: { before: quotationAuditSummary(quotation.toObject()), after: null },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
      severity: 'warning',
    });
    res.json({ success: true, message: 'Quotation deleted' });
  } catch (err) { next(err); }
};
