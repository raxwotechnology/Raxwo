const Subscription = require('../models/Subscription');
const Project = require('../models/Project');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');
const { isLedgerBankMethod, appendBankTransaction } = require('../utils/bankLedger');
const { mapSubscriptionPaymentMethod, logSubscriptionIncome } = require('../utils/financeSubscriptionIncome');

// ── helpers ────────────────────────────────────────────
const SUBSCRIPTION_TYPE_LABELS = {
  website_maintenance: 'Website Maintenance',
  app_maintenance: 'App Maintenance',
  hosting_domain: 'Hosting & Domain',
  social_media_facebook: 'Facebook Management',
  social_media_instagram: 'Instagram Management',
  social_media_tiktok: 'TikTok Marketing',
  social_media_management: 'Social Media Management',
  content_management: 'Content Management',
  technical_support: 'Technical Support',
  bug_fixing: 'Bug Fixing',
  seo_marketing: 'SEO & Marketing',
  custom: 'Custom Service',
};

function calendarDaysUntilDue(nextDueDate) {
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  return Math.round((due - t0) / 86400000);
}

/** Full days past due (0 if still within the due calendar day). */
function calcOverdueDays(nextDueDate) {
  if (!nextDueDate) return 0;
  const now = new Date();
  const dueEnd = new Date(nextDueDate);
  dueEnd.setHours(23, 59, 59, 999);
  if (now <= dueEnd) return 0;
  return Math.ceil((now - dueEnd) / 86400000);
}

async function sendAdminSubscriptionReminders() {
  const subs = await Subscription.find({
    status: { $in: ['active', 'overdue'] },
    reminderDaysBefore: { $gte: 1, $lte: 120 },
  }).populate('client', 'name');

  const admins = await User.find({ role: { $in: ['admin', 'manager'] } }).select('_id');
  const adminIds = admins.map((a) => a._id);
  if (!subs.length || !adminIds.length) return;

  for (const sub of subs) {
    const n = Number(sub.reminderDaysBefore);
    if (!n) continue;
    const daysUntil = calendarDaysUntilDue(sub.nextDueDate);
    if (daysUntil !== n) continue;

    const dueKey = `${sub._id}-${new Date(sub.nextDueDate).toISOString().slice(0, 10)}`;
    if (String(sub.lastSubscriptionReminderDay || '') === dueKey) continue;

    await Subscription.updateOne({ _id: sub._id }, { $set: { lastSubscriptionReminderDay: dueKey } });

    const title = `Subscription due soon: ${sub.title}`;
    const msg = `${sub.client?.name || 'Client'} — "${sub.title}" is due in ${n} day(s) (due ${new Date(sub.nextDueDate).toLocaleDateString('en-LK')}).`;

    await Promise.all(
      adminIds.map((rid) =>
        createNotification({
          recipient: rid,
          title,
          message: msg,
          type: 'subscription',
          link: '/admin/subscriptions',
        })
      )
    );
  }
}

function advanceDueDate(current, frequency) {
  const d = new Date(current);
  switch (frequency) {
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'semi_annual': d.setMonth(d.getMonth() + 6); break;
    case 'annual': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return d;
}

// ── GET all subscriptions ──────────────────────────────
// Admin: all, Client: own
exports.getSubscriptions = async (req, res, next) => {
  try {
    const query = req.user.role === 'client' ? { client: req.user._id } : { client: { $ne: null } };

    if (req.query.status) query.status = req.query.status;
    if (req.query.type) query.subscriptionType = req.query.type;
    if (req.query.clientId && req.user.role !== 'client') query.client = req.query.clientId;

    const subs = await Subscription.find(query)
      .populate('client', 'name email phone')
      .populate('project', 'title status')
      .populate('previousProjects', 'title status')
      .select('-payments.recordedBy -adminNotes')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    if (req.user.role !== 'client') {
      setImmediate(() => {
        sendAdminSubscriptionReminders().catch(() => {});
      });
    }

    const now = new Date();

    // Compute live overdue for each
    const enriched = subs.map((s) => {
      const obj = { ...s };
      const amount = s.amount || 0;
      const totalPaid = (s.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      let dynamicBilled = s.totalBilled || 0;
      if (dynamicBilled === 0 && amount > 0) dynamicBilled = amount;

      const remaining = Math.max(0, dynamicBilled - totalPaid);
      obj.totalPaid = totalPaid;
      obj.remainingBalance = remaining;

      const dueEnd = new Date(s.nextDueDate || new Date());
      dueEnd.setHours(23, 59, 59, 999);

      if (remaining === 0 || now <= dueEnd) {
        obj.overdueDays = 0;
        if (s.status === 'overdue') obj.status = 'active';
      } else {
        obj.overdueDays = calcOverdueDays(s.nextDueDate);
        if (s.status === 'active') obj.status = 'overdue';
      }

      obj.typeLabel = s.subscriptionType === 'custom' && s.customServiceType
        ? s.customServiceType
        : SUBSCRIPTION_TYPE_LABELS[s.subscriptionType] || s.subscriptionType;
      return obj;
    });


    // Filter out orphaned subscriptions (client was deleted from DB)
    const filtered = enriched.filter(s => s.client && s.client._id);

    res.json({ success: true, count: filtered.length, subscriptions: filtered });
  } catch (err) { next(err); }
};

// ── GET single subscription ───────────────────────────
exports.getSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate('project', 'title status progress budget')
      .populate('previousProjects', 'title status')
      .populate('payments.recordedBy', 'name');
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
    if (req.user.role === 'client' && String(sub.client._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const obj = sub.toObject();
    obj.overdueDays = calcOverdueDays(sub.nextDueDate);
    
    const now = new Date();
    let amount = sub.amount || 0;
    let totalPaid = sub.totalPaid || 0;
    let dynamicBilled = sub.totalBilled || 0;
    if (dynamicBilled === 0 && amount > 0) dynamicBilled = amount;
    let tempNext = advanceDueDate(new Date(sub.nextDueDate || new Date()), sub.billingFrequency);
    tempNext.setHours(23, 59, 59, 999);
    while (now > tempNext) {
       dynamicBilled += amount;
       tempNext = advanceDueDate(tempNext, sub.billingFrequency);
    }
    obj.remainingBalance = Math.max(0, dynamicBilled - totalPaid);
    
    obj.typeLabel = sub.subscriptionType === 'custom' && sub.customServiceType
      ? sub.customServiceType
      : SUBSCRIPTION_TYPE_LABELS[sub.subscriptionType] || sub.subscriptionType;
    res.json({ success: true, subscription: obj });
  } catch (err) { next(err); }
};

// ── CREATE subscription (admin) ───────────────────────
exports.createSubscription = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.branch === '') payload.branch = null;
    if (payload.project === '') payload.project = null;
    if (!payload.subscriptionNo) delete payload.subscriptionNo;

    // Ensure valid client
    const client = await User.findById(payload.client);
    if (!client || client.role !== 'client') {
      return res.status(400).json({ success: false, message: 'Valid client required' });
    }

    // Calculate initial nextDueDate if not provided
    if (!payload.nextDueDate) {
      const now = new Date();
      const billingDay = payload.billingDay || 1;
      const next = new Date(now.getFullYear(), now.getMonth() + 1, billingDay);
      payload.nextDueDate = next;
    }

    // Set initial totalBilled to the amount (first billing cycle)
    payload.totalBilled = payload.amount || 0;

    if (payload.paymentMethod && payload.amount > 0) {
      payload.totalPaid = Number(payload.amount);
      payload.payments = [{
        amount: Number(payload.amount),
        method: payload.paymentMethod,
        bankAccount: payload.bankAccount || null,
        paidAt: new Date(),
        note: 'Initial setup payment'
      }];
      if (payload.nextDueDate) {
        payload.nextDueDate = advanceDueDate(payload.nextDueDate, payload.billingFrequency || 'monthly');
        payload.totalBilled = (payload.amount || 0) * 2;
      }
    }

    const sub = await Subscription.create(payload);

    if (payload.paymentMethod && payload.amount > 0) {
      await logSubscriptionIncome({
        sub,
        amount: payload.amount,
        date: new Date(),
        createdBy: req.user._id,
        kind: 'created',
        method: payload.paymentMethod,
        note: `Sub No: ${sub.subscriptionNo || ''} | Initial setup`,
        bankAccount: payload.bankAccount || null,
        syncPayment: true,
      });

      if (payload.bankAccount && isLedgerBankMethod(payload.paymentMethod)) {
        await appendBankTransaction(payload.bankAccount, {
          type: 'deposit',
          amount: payload.amount,
          description: `Subscription Setup: ${sub.subscriptionNo || sub.title}`,
          date: new Date(),
          recordedBy: req.user._id,
          moduleSource: 'subscriptions',
        });
      }
    }

    await createNotification({
      recipient: sub.client,
      title: 'New Subscription Created',
      message: `Subscription "${sub.title}" (${SUBSCRIPTION_TYPE_LABELS[sub.subscriptionType] || sub.subscriptionType}) has been set up. Monthly amount: LKR ${Number(sub.amount).toLocaleString()}.`,
      type: 'subscription',
      link: '/my-subscriptions',
    });

    const fresh = await Subscription.findById(sub._id)
      .populate('client', 'name email phone')
      .populate('project', 'title status');

    res.status(201).json({ success: true, subscription: fresh || sub });
  } catch (err) { next(err); }
};

// ── UPDATE subscription (admin) ───────────────────────
exports.updateSubscription = async (req, res, next) => {
  try {
    const existing = await Subscription.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Subscription not found' });

    const updates = { ...req.body };
    if (updates.branch === '') updates.branch = null;
    if (updates.project === '') updates.project = null;
    // Don't allow overwriting payments via update
    delete updates.payments;

    ['amount', 'billingDay', 'gracePeriodDays', 'reminderDaysBefore'].forEach((k) => {
      if (updates[k] !== undefined && updates[k] !== null && updates[k] !== '') {
        const num = Number(updates[k]);
        if (Number.isFinite(num)) updates[k] = num;
        else delete updates[k];
      }
    });
    if (updates.reminderDaysBefore === 0) updates.reminderDaysBefore = null;

    const sub = await Subscription.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('client', 'name email phone')
      .populate('project', 'title status');

    // Notify client of important changes
    if (updates.amount !== undefined && Number(updates.amount) !== Number(existing.amount)) {
      await createNotification({
        recipient: sub.client._id || sub.client,
        title: 'Subscription Amount Updated',
        message: `Your "${sub.title}" subscription amount changed from LKR ${Number(existing.amount).toLocaleString()} to LKR ${Number(sub.amount).toLocaleString()}.`,
        type: 'subscription',
        link: '/my-subscriptions',
      });
    }
    if (updates.status && updates.status !== existing.status) {
      await createNotification({
        recipient: sub.client._id || sub.client,
        title: 'Subscription Status Changed',
        message: `Your "${sub.title}" subscription status is now "${sub.status}".`,
        type: 'subscription',
        link: '/my-subscriptions',
      });
    }

    res.json({ success: true, subscription: sub });
  } catch (err) { next(err); }
};

// ── DELETE subscription (admin) ───────────────────────
exports.deleteSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id).populate('client', 'name email');
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    const { createAuditLog } = require('./auditController');
    await createAuditLog({
      user: req.user,
      action: 'delete',
      module: 'subscriptions',
      entityId: sub._id,
      entityName: sub.title || sub.subscriptionNo,
      description: `Deleted subscription "${sub.title}" for ${sub.client?.name || 'client'} (collected LKR ${Number(sub.totalPaid || 0).toLocaleString()})`,
      changes: { before: sub.toObject() },
      severity: 'warning',
    });

    await sub.deleteOne();
    res.json({ success: true, message: 'Subscription deleted' });
  } catch (err) { next(err); }
};

// ── RECORD PAYMENT (admin) ───────────────────────────
exports.recordPayment = async (req, res, next) => {
  try {
    const {
      amount, method, reference, note, bankAccount,
      chequeNumber, chequeDate, chequeBank, chequeDrawer,
      paidAt,
    } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });

    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    const m = method || 'cash';
    if (m === 'bank_transfer' && !bankAccount) {
      return res.status(400).json({ success: false, message: 'Select a bank account for bank transfer payments' });
    }
    if (m === 'cheque' && !chequeNumber) {
      return res.status(400).json({ success: false, message: 'Cheque number is required for cheque payments' });
    }
    const paymentDate = paidAt ? new Date(paidAt) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid payment date' });
    }
    paymentDate.setHours(12, 0, 0, 0);

    sub.payments.push({
      amount: Number(amount),
      method: m,
      reference: reference || '',
      note: note || '',
      bankAccount: bankAccount || null,
      recordedBy: req.user._id,
      paidAt: paymentDate,
      chequeNumber: chequeNumber || '',
      chequeDate: chequeDate ? new Date(chequeDate) : undefined,
      chequeBank: chequeBank || '',
      chequeDrawer: chequeDrawer || '',
    });

    const totalPaid = sub.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    sub.totalPaid = totalPaid;
    const subAmt = Number(sub.amount || 0);
    const cyclesPaid = subAmt > 0 ? Math.floor(totalPaid / subAmt) : 0;

    let startDate = sub.startDate ? new Date(sub.startDate) : new Date(sub.createdAt || Date.now());
    let nextDue = new Date(startDate);
    for (let i = 0; i < cyclesPaid; i++) {
      nextDue = advanceDueDate(nextDue, sub.billingFrequency);
    }
    sub.nextDueDate = nextDue;

    let billed = Math.max(subAmt, cyclesPaid * subAmt);
    const now = new Date();
    let tempDue = new Date(nextDue);
    tempDue.setHours(23, 59, 59, 999);
    if (now > tempDue && subAmt > 0) {
      billed += subAmt;
    }
    sub.totalBilled = billed;

    const remaining = Math.max(0, billed - totalPaid);
    const dueEnd = new Date(nextDue);
    dueEnd.setHours(23, 59, 59, 999);

    if (remaining === 0 || now <= dueEnd) {
      sub.status = 'active';
      sub.overdueDays = 0;
    } else {
      sub.status = 'overdue';
      sub.overdueDays = Math.ceil((now - dueEnd) / 86400000);
    }

    await sub.save();


    await logSubscriptionIncome({
      sub,
      amount: Number(amount),
      date: paymentDate,
      createdBy: req.user._id,
      kind: 'payment',
      method: m,
      note: `Sub No: ${sub.subscriptionNo || ''} | Ref: ${reference || '—'} | Method: ${m}`,
      reference: reference || '',
      bankAccount: bankAccount || null,
      syncPayment: false,
    });

    if (bankAccount && isLedgerBankMethod(m)) {
      const amt = Number(amount);
      await appendBankTransaction(bankAccount, {
        type: 'deposit',
        amount: amt,
        description: `Subscription Payment: ${sub.subscriptionNo || sub.title}`,
        date: paymentDate,
        reference: reference || '',
        recordedBy: req.user._id,
        moduleSource: 'subscriptions',
      });
    }

    await createNotification({
      recipient: sub.client?._id || sub.client,
      title: 'Payment Recorded',
      message: `Payment of LKR ${Number(amount).toLocaleString()} recorded for "${sub.title}". Remaining: LKR ${Math.max(0, sub.totalBilled - sub.totalPaid).toLocaleString()}.`,
      type: 'subscription',
      link: '/my-subscriptions',
    });

    res.json({ success: true, subscription: sub });
  } catch (err) { next(err); }
};

// ── ADD AGREEMENT (admin) ─────────────────────────────
exports.addAgreement = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/agreements/${req.file.filename}`;
    const agreement = {
      title: req.body.title || 'Subscription Agreement',
      type: req.body.type || 'service',
      fileUrl,
      fileName: req.file.originalname,
      validFrom: req.body.validFrom || undefined,
      validUntil: req.body.validUntil || undefined,
      notes: req.body.notes || '',
    };

    sub.agreements.push(agreement);
    await sub.save();

    // Also push to CRM Agreements so it appears in the client's agreement history
    const Agreement = require('../models/Agreement');
    await Agreement.create({
      agreementType: 'subscription_service',
      title: agreement.title,
      client: sub.client,
      subscription: sub._id,
      content: `Subscription Agreement attached for: ${sub.title}<br/>${agreement.notes || ''}`,
      fileUrl,
      status: 'finalised',
      createdBy: req.user._id,
      agreementDate: agreement.validFrom || new Date(),
    });

    res.json({ success: true, message: 'Agreement added and synced to CRM', subscription: sub });
  } catch (err) { next(err); }
};

exports.removeAgreement = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    sub.agreements = sub.agreements.filter(a => String(a._id) !== req.params.agreementId);
    await sub.save();

    res.json({ success: true, message: 'Agreement removed', subscription: sub });
  } catch (err) { next(err); }
};

// ── BULK SEND HISTORY (admin) ─────────────────────────
exports.bulkSendHistory = async (req, res, next) => {
  try {
    const { subscriptionIds = [], methods = ['email'] } = req.body;
    if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one subscription' });
    }

    const emailService = require('../services/emailService');
    const smsService = require('../services/smsService');
    const results = [];

    for (const id of subscriptionIds) {
      const sub = await Subscription.findById(id).populate('client', 'name email phone');
      if (!sub?.client) {
        results.push({ id, success: false, message: 'Subscription or client not found' });
        continue;
      }
      const client = sub.client;
      let sentEmail = false;
      let sentSms = false;
      try {
        if (methods.includes('email') && client.email) {
          await emailService.sendSubscriptionHistoryEmail(client.email, client.name, sub);
          sentEmail = true;
        }
        if (methods.includes('sms') && client.phone) {
          await smsService.sendSubscriptionHistorySms(client.phone, client.name, sub.title, sub.totalPaid);
          sentSms = true;
        }
        if (!sentEmail && !sentSms) {
          results.push({ id, success: false, message: 'No valid contact methods' });
        } else {
          results.push({ id, success: true, sentEmail, sentSms, title: sub.title });
        }
      } catch (err) {
        results.push({ id, success: false, message: err.message || 'Send failed' });
      }
    }

    const ok = results.filter((r) => r.success).length;
    res.json({
      success: ok > 0,
      message: `Sent ${ok} of ${subscriptionIds.length} subscription invoice(s)`,
      results,
    });
  } catch (err) { next(err); }
};

// ── SEND HISTORY (admin) ──────────────────────────────
exports.sendHistory = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id).populate('client', 'name email phone');
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    const client = sub.client;
    if (!client) return res.status(400).json({ success: false, message: 'Client not associated with this subscription' });

    const methods = req.body.methods || ['email'];
    const emailService = require('../services/emailService');
    const smsService = require('../services/smsService');

    let sentEmail = false;
    let sentSms = false;

    if (methods.includes('email') && client.email) {
      await emailService.sendSubscriptionHistoryEmail(client.email, client.name, sub);
      sentEmail = true;
    }

    if (methods.includes('sms') && client.phone) {
      await smsService.sendSubscriptionHistorySms(client.phone, client.name, sub.title, sub.totalPaid);
      sentSms = true;
    }

    if (!sentEmail && !sentSms) {
      return res.status(400).json({ success: false, message: 'No valid contact methods found for client.' });
    }

    res.json({ success: true, message: 'History sent successfully' });
  } catch (err) { next(err); }
};

// ── BILLING OVERVIEW (admin dashboard) ────────────────
exports.getBillingOverview = async (req, res, next) => {
  try {
    const { branch, month, startDate, endDate } = req.query;
    let subMatch = { status: { $in: ['active', 'overdue'] }, client: { $ne: null } };
    if (branch && branch !== 'undefined' && branch !== 'null') {
      subMatch.branch = branch;
    }

    const subs = await Subscription.find(subMatch)
      .populate('client', 'name email')
      .populate('project', 'title');

    const now = new Date();

    // Determine target period for monthly isolation
    let rangeStart, rangeEnd;
    if (startDate && endDate) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      if (sy && sm && sd && ey && em && ed) {
        rangeStart = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        rangeEnd = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      } else {
        rangeStart = new Date(startDate);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(endDate);
        rangeEnd.setHours(23, 59, 59, 999);
      }
    } else if (month) {
      const [y, m] = month.split('-').map(Number);
      if (y && m) {
        rangeStart = new Date(y, m - 1, 1, 0, 0, 0);
        rangeEnd = new Date(y, m, 0, 23, 59, 59, 999);
      }
    }
    if (!rangeStart || !rangeEnd || isNaN(rangeStart.getTime())) {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    let totalMRR = 0;
    let totalOverdue = 0;
    let totalCollected = 0;
    let monthlyCollected = 0;
    let pendingPayments = 0;
    let overduePayments = 0;
    let overdueCount = 0;

    const clientSummaries = {};

    subs.forEach((s) => {
      let amount = s.amount || 0;
      let totalPaid = s.totalPaid || 0;

      // Monthly Recurring Revenue
      let monthlyEquiv = amount;
      if (s.billingFrequency === 'quarterly') monthlyEquiv = amount / 3;
      else if (s.billingFrequency === 'semi_annual') monthlyEquiv = amount / 6;
      else if (s.billingFrequency === 'annual') monthlyEquiv = amount / 12;
      totalMRR += monthlyEquiv;

      const overdue = calcOverdueDays(s.nextDueDate);
      
      let dynamicBilled = s.totalBilled || 0;
      if (dynamicBilled === 0 && amount > 0) dynamicBilled = amount;
      let tempNext = advanceDueDate(new Date(s.nextDueDate || new Date()), s.billingFrequency);
      tempNext.setHours(23, 59, 59, 999);
      while (now > tempNext) {
         dynamicBilled += amount;
         tempNext = advanceDueDate(tempNext, s.billingFrequency);
      }
      const remaining = Math.max(0, dynamicBilled - totalPaid);

      if (overdue > 0 || (remaining > 0 && overdue > 0)) {
        totalOverdue += remaining;
        overduePayments += remaining;
        overdueCount++;
      }
      if (remaining > 0) {
        pendingPayments += remaining;
      }

      // Calculate total & monthly collected from payment records
      (s.payments || []).forEach((p) => {
        const pAmt = p.amount || 0;
        totalCollected += pAmt;
        if (p.paidAt) {
          const pd = new Date(p.paidAt);
          if (pd >= rangeStart && pd <= rangeEnd) {
            monthlyCollected += pAmt;
          }
        }
      });

      // Fallback if payments array is empty but totalPaid > 0
      if ((!s.payments || s.payments.length === 0) && totalPaid > 0) {
        totalCollected += totalPaid;
      }

      // Skip orphaned subscriptions (client was deleted) from client grouping
      if (!s.client || !s.client._id) return;

      const clientId = String(s.client._id);
      if (!clientSummaries[clientId]) {
        clientSummaries[clientId] = {
          client: s.client,
          subscriptions: [],
          totalDue: 0,
          totalPaid: 0,
          overdueAmount: 0,
          overdueSubs: 0,
        };
      }
      clientSummaries[clientId].subscriptions.push({
        _id: s._id,
        title: s.title,
        type: s.subscriptionType,
        typeLabel: s.subscriptionType === 'custom' && s.customServiceType
          ? s.customServiceType
          : SUBSCRIPTION_TYPE_LABELS[s.subscriptionType] || s.subscriptionType,
        amount: s.amount,
        status: overdue > 0 ? 'overdue' : s.status,
        overdueDays: overdue,
        nextDueDate: s.nextDueDate,
        remaining,
      });
      clientSummaries[clientId].totalDue += dynamicBilled;
      clientSummaries[clientId].totalPaid += s.totalPaid;
      if (overdue > 0) {
        clientSummaries[clientId].overdueAmount += remaining;
        clientSummaries[clientId].overdueSubs++;
      }
    });

    // Hosting renewals coming up (next 30 days)
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const hostingRenewals = await Subscription.find({
      'hostingDetails.expiryDate': { $lte: thirtyDaysOut, $gte: now },
      status: { $in: ['active', 'overdue'] },
      ...(subMatch.branch ? { branch: subMatch.branch } : {}),
    }).populate('client', 'name email').populate('project', 'title');

    // Monthly revenue for chart (last 12 months)
    const monthlyRevenue = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      let revenue = 0;
      subs.forEach((s) => {
        (s.payments || []).forEach((p) => {
          const pd = new Date(p.paidAt);
          if (pd >= monthStart && pd <= monthEnd) revenue += p.amount;
        });
      });
      monthlyRevenue.push({
        month: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        revenue,
      });
    }

    // Subscription type distribution
    const typeDist = {};
    subs.forEach((s) => {
      const label = s.subscriptionType === 'custom' && s.customServiceType
        ? s.customServiceType
        : SUBSCRIPTION_TYPE_LABELS[s.subscriptionType] || s.subscriptionType;
      typeDist[label] = (typeDist[label] || 0) + 1;
    });

    const result = {
      totalMRR: Math.round(totalMRR),
      totalOverdue: Math.round(totalOverdue),
      totalCollected: Math.round(totalCollected),
      monthlyCollected: Math.round(monthlyCollected),
      pendingPayments: Math.round(pendingPayments),
      overduePayments: Math.round(overduePayments),
      overdueCount,
      activeCount: subs.filter(s => s.status === 'active').length,
      totalSubscriptions: subs.length,
      clientSummaries: Object.values(clientSummaries),
      hostingRenewals,
      monthlyRevenue,
      typeDist: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
      selectedPeriod: {
        startDate: rangeStart.toISOString().split('T')[0],
        endDate: rangeEnd.toISOString().split('T')[0],
      },
    };

    res.json({
      success: true,
      overview: result,
    });
  } catch (err) { next(err); }
};

// ── CHECK & UPDATE OVERDUE (cron-like) ────────────────
exports.processOverdue = async (req, res, next) => {
  try {
    const subs = await Subscription.find({ status: { $in: ['active', 'overdue'] } });
    let updated = 0;
    const now = new Date();

    for (const sub of subs) {
      const totalPaid = (sub.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      const amount = Number(sub.amount || 0);
      const cyclesPaid = amount > 0 ? Math.floor(totalPaid / amount) : 0;
      
      let startDate = sub.startDate ? new Date(sub.startDate) : new Date(sub.createdAt || Date.now());
      let nextDue = new Date(startDate);
      for (let i = 0; i < cyclesPaid; i++) {
        nextDue = advanceDueDate(nextDue, sub.billingFrequency);
      }

      let billed = Math.max(amount, cyclesPaid * amount);
      let tempDue = new Date(nextDue);
      tempDue.setHours(23, 59, 59, 999);
      if (now > tempDue && amount > 0) {
        billed += amount;
      }
      const remaining = Math.max(0, billed - totalPaid);
      const dueEnd = new Date(nextDue);
      dueEnd.setHours(23, 59, 59, 999);

      const days = now > dueEnd ? Math.ceil((now - dueEnd) / 86400000) : 0;

      if (remaining === 0 || days <= 0) {
        if (sub.status === 'overdue' || sub.overdueDays > 0) {
          sub.status = 'active';
          sub.overdueDays = 0;
          sub.lastOverdueCheck = now;
          sub.nextDueDate = nextDue;
          sub.totalPaid = totalPaid;
          sub.totalBilled = billed;
          await sub.save();
          updated++;
        }
      } else {
        if (sub.status !== 'overdue' || sub.overdueDays !== days) {
          sub.status = 'overdue';
          sub.overdueDays = days;
          sub.lastOverdueCheck = now;
          sub.nextDueDate = nextDue;
          sub.totalPaid = totalPaid;
          sub.totalBilled = billed;
          await sub.save();
          updated++;

          await createNotification({
            recipient: sub.client,
            title: '⚠️ Subscription Overdue',
            message: `Your "${sub.title}" subscription is ${days} day(s) overdue. Please make payment to avoid service interruption.`,
            type: 'subscription',
            link: '/my-subscriptions',
          });
        }
      }
    }

    res.json({ success: true, message: `Processed ${subs.length} subscriptions, ${updated} updated` });
  } catch (err) { next(err); }
};


// ── CREATE INVOICE FROM PAYMENT (admin) ─────────────────
exports.createInvoiceFromPayment = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
    const payment = sub.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    
    const Invoice = require('../models/Invoice');
    
    // Check if an invoice already exists for this exact payment (compare timestamps)
    const existingInvoice = await Invoice.findOne({
      subscriptionRef: sub._id,
      invoiceDate: new Date(payment.paidAt),
      subtotal: payment.amount
    });
    
    if (existingInvoice) {
      return res.json({ success: true, message: 'Invoice retrieved', invoice: existingInvoice });
    }

    const SiteSetting = require('../models/SiteSetting');
    const settings = await SiteSetting.findOne();
    
    let signatures = {};
    if (settings) {
      if (req.body.withSeal && settings.sealUrl) {
        signatures.seal = { data: settings.sealUrl, note: '' };
      }
      if (settings.signatures && settings.signatures.director && settings.signatures.director.url) {
        signatures.authorizer = {
          data: settings.signatures.director.url,
          name: settings.quotationDirectorName || '',
          title: settings.signatures.director.label || 'Director'
        };
      }
    }

    let invoice = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        const { generateAutoInvoiceNo } = require('../utils/allocateInvoiceNoFromQuotation');
        const invoiceNo = await generateAutoInvoiceNo('INV');

        invoice = await Invoice.create({
          client: sub.client,
          project: sub.project,
          invoiceNo,
          invoiceDate: payment.paidAt,
          dueDate: payment.paidAt,
          serviceType: 'Subscription',
          source: 'subscription',
          subscriptionRef: sub._id,
          items: [{
            description: `Subscription Payment - ${sub.title}`,
            quantity: 1,
            unitPrice: payment.amount,
            total: payment.amount
          }],
          subtotal: payment.amount,
          total: payment.amount,
          status: 'paid',
          paymentMethod: payment.method,
          bankAccount: payment.bankAccount,
          notes: `Generated from subscription ${sub.subscriptionNo || sub.title} payment (${payment.reference || payment.note || 'No ref'})`,
          createdBy: req.user._id,
          signatures,
          payments: [{
            amount: payment.amount,
            date: payment.paidAt,
            method: payment.method,
            reference: payment.reference,
            notes: payment.note,
            bankAccount: payment.bankAccount,
            recordedBy: payment.recordedBy,
            isAdvance: false
          }]
        });
        break; // Success
      } catch (e) {
        if (e.code === 11000 && attempts < 2) {
          // If a race condition occurred and another request took this invoiceNo, retry.
          // Also check if the invoice was literally just created by the competing request
          const justCreated = await Invoice.findOne({
            subscriptionRef: sub._id,
            invoiceDate: new Date(payment.paidAt),
            subtotal: payment.amount
          });
          if (justCreated) {
            invoice = justCreated;
            break;
          }
          attempts++;
        } else {
          throw e;
        }
      }
    }

    res.json({ success: true, message: 'Invoice retrieved', invoice });
  } catch (err) { next(err); }
};

// ── SEND PAYMENT RECEIPT (admin) ───────────────────────
exports.sendPaymentReceipt = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id).populate('client', 'name email phone');
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
    const payment = sub.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    
    const methods = req.body.methods || ['email'];
    const smsService = require('../services/smsService');
    const client = sub.client;

    let sentEmail = false;
    let sentSms = false;

    if (methods.includes('email') && client.email) {
      const { sendMail } = require('../utils/mailer');
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Payment Receipt</h2>
          <p>Dear ${client.name},</p>
          <p>We have received your payment of <strong>LKR ${payment.amount.toLocaleString()}</strong> for subscription <strong>${sub.title}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Date</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${new Date(payment.paidAt).toLocaleDateString()}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Method</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${payment.method.replace('_', ' ').toUpperCase()}</td></tr>
            ${payment.reference ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Reference</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${payment.reference}</td></tr>` : ''}
          </table>
          <p style="margin-top: 20px;">Thank you for your business!</p>
          <p style="font-size: 12px; color: #64748b;">— Raxwo Team</p>
        </div>
      `;
      await sendMail({
        to: client.email,
        subject: `Payment Receipt - ${sub.title}`,
        html,
        text: `We have received your payment of LKR ${payment.amount} for ${sub.title}.`
      });
      sentEmail = true;
    }

    if (methods.includes('sms') && client.phone) {
      const msg = `Dear ${client.name}, we received LKR ${payment.amount.toLocaleString()} for subscription "${sub.title}". Thank you!`;
      await smsService.sendSms(client.phone, msg, client.name, 'subscription');
      sentSms = true;
    }

    if (!sentEmail && !sentSms) return res.status(400).json({ success: false, message: 'No valid contact methods.' });
    
    res.json({ success: true, message: 'Receipt sent successfully' });
  } catch (err) { next(err); }
};

// ── CLIENT: get my subscription summary ───────────────
exports.getMySubscriptionSummary = async (req, res, next) => {
  try {
    const subs = await Subscription.find({ client: req.user._id })
      .populate('project', 'title status progress')
      .populate('previousProjects', 'title status')
      .sort({ createdAt: -1 });

    let totalDue = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    const now = new Date();

    const enriched = subs.map((s) => {
      const obj = s.toObject();
      obj.overdueDays = calcOverdueDays(s.nextDueDate);
      
      let amount = s.amount || 0;
      let subTotalPaid = s.totalPaid || 0;
      let dynamicBilled = s.totalBilled || 0;
      if (dynamicBilled === 0 && amount > 0) dynamicBilled = amount;
      let tempNext = advanceDueDate(new Date(s.nextDueDate || new Date()), s.billingFrequency);
      tempNext.setHours(23, 59, 59, 999);
      while (now > tempNext) {
         dynamicBilled += amount;
         tempNext = advanceDueDate(tempNext, s.billingFrequency);
      }
      
      obj.remainingBalance = Math.max(0, dynamicBilled - subTotalPaid);
      obj.typeLabel = SUBSCRIPTION_TYPE_LABELS[s.subscriptionType] || s.subscriptionType;
      
      totalDue += dynamicBilled;
      totalPaid += subTotalPaid;
      if (obj.overdueDays > 0) overdueCount++;
      return obj;
    });

    res.json({
      success: true,
      subscriptions: enriched,
      summary: {
        total: enriched.length,
        active: enriched.filter(s => s.status === 'active').length,
        overdue: overdueCount,
        totalDue,
        totalPaid,
        remaining: Math.max(0, totalDue - totalPaid),
      },
    });
  } catch (err) { next(err); }
};
