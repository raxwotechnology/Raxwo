const Agreement = require('../models/Agreement');
const AgreementTemplate = require('../models/AgreementTemplate');
const Project = require('../models/Project');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');

const POPULATE = [
  { path: 'client', select: 'name email phone' },
  { path: 'employee', select: 'name email phone' },
  { path: 'project', select: 'title serviceType budget' },
  { path: 'invoice', select: 'invoiceNo total remainingBalance' },
  { path: 'subscription', select: 'name plan' },
  { path: 'createdBy', select: 'name' },
  { path: 'approvedBy', select: 'name' },
];

function mergeSignatures(prev = {}, incoming = {}) {
  if (!incoming || typeof incoming !== 'object') return prev;
  const p = prev && typeof prev.toObject === 'function' ? prev.toObject() : { ...prev };
  return {
    provider: { ...p.provider, ...incoming.provider },
    client: { ...p.client, ...incoming.client },
    witness: { ...p.witness, ...incoming.witness },
    seal: { ...p.seal, ...incoming.seal },
  };
}

// ── GET /api/agreements/templates ─────────────────────────────────────────────
exports.getAgreementTemplates = async (req, res, next) => {
  try {
    const templates = await AgreementTemplate.find()
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('createdBy', 'name');
    res.json({ success: true, templates });
  } catch (err) { next(err); }
};

// ── POST /api/agreements/templates ────────────────────────────────────────────
exports.createAgreementTemplate = async (req, res, next) => {
  try {
    const { name, content, agreementType, hasFrame } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Template name is required' });
    }
    const template = await AgreementTemplate.create({
      name: name.trim(),
      content: content || '',
      agreementType: agreementType || 'custom',
      hasFrame: hasFrame || false,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, template });
  } catch (err) { next(err); }
};

// ── PUT /api/agreements/templates/:templateId ──────────────────────────────────
exports.updateAgreementTemplate = async (req, res, next) => {
  try {
    const { name, content, agreementType, hasFrame } = req.body;
    const template = await AgreementTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    if (name && String(name).trim()) template.name = name.trim();
    if (content !== undefined) template.content = content;
    if (agreementType) template.agreementType = agreementType;
    if (hasFrame !== undefined) template.hasFrame = hasFrame;
    await template.save();
    res.json({ success: true, template });
  } catch (err) { next(err); }
};

// ── DELETE /api/agreements/templates/:templateId ──────────────────────────────
exports.deleteAgreementTemplate = async (req, res, next) => {
  try {
    await AgreementTemplate.findByIdAndDelete(req.params.templateId);
    res.json({ success: true, message: 'Template removed' });
  } catch (err) { next(err); }
};

// ── GET /api/agreements ────────────────────────────────────────────────────────
exports.getAgreements = async (req, res, next) => {
  try {
    const { client, project, invoice, subscription, status, type, approvalStatus } = req.query;
    const query = {};
    if (client) query.client = client;
    if (project) query.project = project;
    if (invoice) query.invoice = invoice;
    if (subscription) query.subscription = subscription;
    if (status) query.status = status;
    if (type) query.agreementType = type;
    if (approvalStatus) query.approvalStatus = approvalStatus;

    const agreements = await Agreement.find(query)
      .populate(POPULATE)
      .populate({ path: 'history.user', select: 'name' })
      .sort({ createdAt: -1 });
    res.json({ success: true, count: agreements.length, agreements });
  } catch (err) { next(err); }
};

// ── GET /api/agreements/:id ────────────────────────────────────────────────────
exports.getAgreement = async (req, res, next) => {
  try {
    const agreement = await Agreement.findById(req.params.id)
      .populate(POPULATE)
      .populate({ path: 'history.user', select: 'name' });
    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement not found' });
    res.json({ success: true, agreement });
  } catch (err) { next(err); }
};

// ── POST /api/agreements ───────────────────────────────────────────────────────
exports.createAgreement = async (req, res, next) => {
  try {
    const {
      agreementType, title, client, project, invoice, subscription, content, status,
      signatures, approvalStatus, agreementDate, hasFrame,
    } = req.body;

    let finalContent = content || '';
    if (!finalContent) {
      finalContent = await buildTemplateContent(agreementType, { client, project, invoice, subscription });
    }

    const agreement = await Agreement.create({
      agreementType,
      title,
      client: client || undefined,
      project: project || undefined,
      invoice: invoice || undefined,
      subscription: subscription || undefined,
      content: finalContent,
      status: status || 'draft',
      signatures: signatures || undefined,
      approvalStatus: approvalStatus || 'none',
      agreementDate: agreementDate ? new Date(agreementDate) : undefined,
      hasFrame: hasFrame || false,
      createdBy: req.user._id,
      history: [{ action: 'created', detail: title || 'Agreement', user: req.user._id }],
    });

    const populated = await Agreement.findById(agreement._id)
      .populate(POPULATE)
      .populate({ path: 'history.user', select: 'name' });

    if (agreement.client) {
      await createNotification({
        recipient: agreement.client,
        title: 'New Agreement Created',
        message: `An agreement (${agreement.title}) has been generated for your review.`,
        type: 'financial',
        link: `/my-account`
      });
    }

    res.status(201).json({ success: true, agreement: populated });
  } catch (err) { next(err); }
};

// ── PUT /api/agreements/:id ────────────────────────────────────────────────────
exports.updateAgreement = async (req, res, next) => {
  try {
    const prev = await Agreement.findById(req.params.id);
    if (!prev) return res.status(404).json({ success: false, message: 'Agreement not found' });

    const updates = { ...req.body };
    delete updates.history;
    delete updates.agreementNo;
    delete updates.createdBy;

    if (!updates.client) updates.client = undefined;
    if (!updates.project) updates.project = undefined;
    if (!updates.invoice) updates.invoice = undefined;
    if (!updates.subscription) updates.subscription = undefined;

    if (updates.status === 'finalised' && !updates.finalisedAt) updates.finalisedAt = new Date();
    if (updates.status === 'signed' && !updates.signedAt) updates.signedAt = new Date();

    if (updates.approvalStatus !== undefined) {
      if (updates.approvalStatus === 'approved') {
        updates.approvedBy = req.user._id;
        updates.approvedAt = new Date();
      } else {
        updates.approvedBy = undefined;
        updates.approvedAt = undefined;
      }
    }

    if (updates.signatures) {
      updates.signatures = mergeSignatures(prev.signatures, updates.signatures);
    }

    const details = [];
    if (updates.content !== undefined && updates.content !== prev.content) details.push('document body updated');
    if (updates.status !== undefined && updates.status !== prev.status) details.push(`status ${prev.status} → ${updates.status}`);
    if (updates.approvalStatus !== undefined && updates.approvalStatus !== prev.approvalStatus) {
      details.push(`approval ${prev.approvalStatus} → ${updates.approvalStatus}`);
    }
    if (updates.signatures) {
      details.push('signatures updated');
    }
    if (updates.title !== undefined && updates.title !== prev.title) details.push('title changed');

    const historyEntry = details.length
      ? { action: 'updated', detail: details.join('; '), user: req.user._id }
      : null;

    const updateOp = historyEntry
      ? { $set: updates, $push: { history: historyEntry } }
      : { $set: updates };

    const agreement = await Agreement.findByIdAndUpdate(req.params.id, updateOp, { new: true, runValidators: true })
      .populate(POPULATE)
      .populate({ path: 'history.user', select: 'name' });
    res.json({ success: true, agreement });
  } catch (err) { next(err); }
};

// ── DELETE /api/agreements/:id ─────────────────────────────────────────────────
exports.deleteAgreement = async (req, res, next) => {
  try {
    await Agreement.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Agreement deleted' });
  } catch (err) { next(err); }
};

// ── POST /api/agreements/generate-preview ─────────────────────────────────────
exports.generatePreview = async (req, res, next) => {
  try {
    const { agreementType, client, project, invoice, subscription, agreementDate } = req.body;
    const content = await buildTemplateContent(agreementType, { client, project, invoice, subscription, agreementDate });
    res.json({ success: true, content });
  } catch (err) { next(err); }
};

// ── POST /api/agreements/generate-pdf ─────────────────────────────────────────
exports.generateAgreementPdf = async (req, res, next) => {
  try {
    const { html, filename } = req.body;
    if (!html) {
      return res.status(400).json({ success: false, message: 'HTML content is required' });
    }
    const { inlineUploadImagesInHtml } = require('../services/documentHtmlService');
    const inlinedHtml = inlineUploadImagesInHtml(html);

    if (req.query.html === 'true') {
      return res.send(inlinedHtml);
    }

    const { htmlToPdfBuffer } = require('../services/documentPdfService');
    const pdfBuffer = await htmlToPdfBuffer(inlinedHtml);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'agreement'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

function buildCustomAgreementShell(companyName, companyAddress, companyPhone, companyEmail, clientName, today) {
  const addrLine = [companyAddress, companyPhone, companyEmail].filter(Boolean).join(' · ');
  return `
<h2 style="text-transform:uppercase;letter-spacing:0.06em;font-size:1.1rem;">Custom Agreement</h2>
<p style="font-size:0.95rem;line-height:1.65;">This agreement is made on <strong>${today}</strong> between <strong>${companyName}</strong>${addrLine ? ` (${addrLine})` : ''}, hereinafter the <em>Company</em>, and <strong>${clientName}</strong>, hereinafter the <em>Counterparty</em>.</p>

<h3>1. Purpose</h3>
<p>Describe the commercial or legal purpose of this agreement.</p>

<h3>2. Terms &amp; Conditions</h3>
<p>Set out payment terms, deliverables, timelines, and responsibilities.</p>

<h3>3. Confidentiality</h3>
<p>Both parties agree to protect confidential information disclosed in connection with this agreement.</p>

<h3>4. Term &amp; Termination</h3>
<p>Specify duration, notice periods, and consequences of termination.</p>

<h3>5. Dispute Resolution</h3>
<p>Parties agree to seek good-faith resolution; governing law: Sri Lanka unless otherwise agreed in writing.</p>

<h3>6. Execution</h3>
<p>This agreement may be executed in counterparts. Electronic signatures shall be treated as originals where permitted by law.</p>

<h3>7. Witness / Approval (optional)</h3>
<p>Name and capacity of witness or internal approver, if required by your organisation.</p>
<p>Witness name: ___________________________ &nbsp; Signature: ___________________________ &nbsp; Date: __________</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:2rem 0;"/>
<p style="font-size:0.85rem;color:#64748b;"><strong>Signature blocks</strong></p>
<table style="width:100%;border-collapse:collapse;margin-top:0.5rem;font-size:0.9rem;">
  <tr>
    <td style="width:48%;vertical-align:top;padding:12px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-weight:600;">${companyName}</p>
      <p style="margin:0 0 32px;">Authorised signatory</p>
      <p style="margin:0;">Name: ___________________________</p>
      <p style="margin:8px 0 0;">Date: ___________________________</p>
    </td>
    <td style="width:4%;"></td>
    <td style="width:48%;vertical-align:top;padding:12px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-weight:600;">${clientName}</p>
      <p style="margin:0 0 32px;">Authorised signatory</p>
      <p style="margin:0;">Name: ___________________________</p>
      <p style="margin:8px 0 0;">Date: ___________________________</p>
    </td>
  </tr>
</table>
  `.trim();
}

// ── Template builder ──────────────────────────────────────────────────────────
async function buildTemplateContent(type, { client, project, invoice, subscription, agreementDate }) {
  const siteSettings = await require('../models/SiteSetting').findOne().catch(() => null);
  const companyName = siteSettings?.siteName || 'Raxwo Technology';
  const companyAddress = siteSettings?.contactAddress || '';
  const companyPhone = siteSettings?.contactPhone || '';
  const companyEmail = siteSettings?.contactEmail || '';

  const today = agreementDate
    ? new Date(agreementDate).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });

  let clientDoc = null; let projectDoc = null; let invoiceDoc = null;
  const { Types } = require('mongoose');
  if (client && Types.ObjectId.isValid(client)) clientDoc = await User.findById(client).select('name email phone');
  if (project && Types.ObjectId.isValid(project)) projectDoc = await Project.findById(project).populate('client', 'name').select('title serviceType budget description startDate deadline');
  if (invoice && Types.ObjectId.isValid(invoice)) invoiceDoc = await Invoice.findById(invoice).populate('client', 'name').select('invoiceNo total remainingBalance dueDate');

  const clientName = clientDoc?.name || projectDoc?.client?.name || invoiceDoc?.client?.name || '{{CLIENT_NAME}}';
  const clientEmail = clientDoc?.email || '{{CLIENT_EMAIL}}';
  const clientPhone = clientDoc?.phone || '{{CLIENT_PHONE}}';

  const companyLine = `${companyName}${companyAddress ? `, ${companyAddress}` : ''}`;

  const templates = {
    client_project: `
<h2>PROJECT AGREEMENT</h2>
<p>This Project Agreement ("Agreement") is entered into as of <strong>${today}</strong> between:</p>
<p><strong>${companyLine}</strong> ("Service Provider")</p>
<p>and</p>
<p><strong>${clientName}</strong>${clientEmail ? `, ${clientEmail}` : ''}${clientPhone ? `, ${clientPhone}` : ''} ("Client")</p>

<h3>1. Project Details</h3>
<p><strong>Project Name:</strong> ${projectDoc?.title || '{{PROJECT_NAME}}'}</p>
<p><strong>Service Type:</strong> ${projectDoc?.serviceType || '{{SERVICE_TYPE}}'}</p>
<p><strong>Description:</strong> ${projectDoc?.description || '{{PROJECT_DESCRIPTION}}'}</p>
<p><strong>Start Date:</strong> ${projectDoc?.startDate ? new Date(projectDoc.startDate).toLocaleDateString('en-LK') : '{{START_DATE}}'}</p>
<p><strong>Expected Completion:</strong> ${projectDoc?.deadline ? new Date(projectDoc.deadline).toLocaleDateString('en-LK') : '{{DEADLINE}}'}</p>

<h3>2. Project Budget</h3>
<p>The total project budget is <strong>LKR ${projectDoc?.budget?.toLocaleString() || '{{BUDGET}}'}</strong></p>

<h3>3. Payment Terms</h3>
<p>Payment schedule and terms to be agreed upon separately. All payments must be made according to the invoice issued by the Service Provider.</p>

<h3>4. Scope of Work</h3>
<p>The scope of work is defined by the project description above and any attached specifications. Any changes to scope must be agreed in writing by both parties.</p>

<h3>5. Confidentiality</h3>
<p>Both parties agree to maintain confidentiality of proprietary information shared during the project.</p>

<h3>6. Intellectual Property</h3>
<p>Upon receipt of full payment, the Client shall own all deliverables produced specifically for this project.</p>

<h3>7. Governing Law</h3>
<p>This Agreement shall be governed by the laws of Sri Lanka.</p>

<p>By proceeding with this project, both parties agree to the terms outlined in this Agreement.</p>

<h3>8. Witness (optional)</h3>
<p>Witness: ___________________________ &nbsp; Date: __________</p>

<p>__________________________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;__________________________</p>
<p><strong>${companyName}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>${clientName}</strong></p>
<p>Service Provider&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Client</p>
<p>Date: ${today}</p>
    `.trim(),

    subscription_service: `
<h2>SUBSCRIPTION SERVICE AGREEMENT</h2>
<p>This Subscription Service Agreement ("Agreement") is entered into as of <strong>${today}</strong> between:</p>
<p><strong>${companyLine}</strong> ("Service Provider") and <strong>${clientName}</strong> ("Subscriber")</p>

<h3>1. Service Details</h3>
<p>The Service Provider agrees to provide the subscribed services as outlined in the subscription plan selected by the Subscriber.</p>

<h3>2. Subscription Term</h3>
<p>This agreement is effective from the subscription start date and renews automatically unless cancelled.</p>

<h3>3. Payment</h3>
<p>The Subscriber agrees to pay the subscription fee on the agreed billing cycle (monthly/annual). Late payments may result in service suspension.</p>

<h3>4. Service Level</h3>
<p>The Service Provider shall endeavour to maintain 99% uptime for hosted services. Scheduled maintenance will be notified in advance.</p>

<h3>5. Termination</h3>
<p>Either party may terminate this agreement with 30 days written notice. No refunds for partial periods.</p>

<h3>6. Witness (optional)</h3>
<p>Witness: ___________________________ &nbsp; Date: __________</p>

<p>__________________________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;__________________________</p>
<p><strong>${companyName}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>${clientName}</strong></p>
<p>Date: ${today}</p>
    `.trim(),

    invoice_payment: `
<h2>PAYMENT AGREEMENT</h2>
<p>This Payment Agreement is entered into as of <strong>${today}</strong> between <strong>${companyName}</strong> and <strong>${clientName}</strong>.</p>

<h3>Invoice Reference</h3>
<p><strong>Invoice No:</strong> ${invoiceDoc?.invoiceNo || '{{INVOICE_NO}}'}</p>
<p><strong>Total Amount:</strong> LKR ${invoiceDoc?.total?.toLocaleString() || '{{AMOUNT}}'}</p>
<p><strong>Outstanding Balance:</strong> LKR ${invoiceDoc?.remainingBalance?.toLocaleString() || '{{BALANCE}}'}</p>
<p><strong>Due Date:</strong> ${invoiceDoc?.dueDate ? new Date(invoiceDoc.dueDate).toLocaleDateString('en-LK') : '{{DUE_DATE}}'}</p>

<h3>Payment Schedule</h3>
<p>The Client agrees to settle the outstanding balance by the due date specified above.</p>

<h3>Late Payment</h3>
<p>Late payments may incur charges at the discretion of the Service Provider.</p>

<h3>Witness (optional)</h3>
<p>Witness: ___________________________ &nbsp; Date: __________</p>

<p>__________________________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;__________________________</p>
<p><strong>${companyName}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>${clientName}</strong></p>
<p>Date: ${today}</p>
    `.trim(),

    general: `
<h2>GENERAL AGREEMENT</h2>
<p>This Agreement is entered into as of <strong>${today}</strong> between <strong>${companyName}</strong> and <strong>${clientName}</strong>.</p>
<p>[Enter agreement details here]</p>

<h3>Witness (optional)</h3>
<p>Witness: ___________________________ &nbsp; Date: __________</p>

<p>__________________________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;__________________________</p>
<p><strong>${companyName}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>${clientName}</strong></p>
<p>Date: ${today}</p>
    `.trim(),

    employee_agreement: `
<h2>INTERNSHIP & EMPLOYMENT AGREEMENT</h2>
<p>This Agreement is entered into as of <strong>${today}</strong> between <strong>${companyLine}</strong> ("Company") and <strong>{{EmployeeName}}</strong> (Employee ID: <strong>{{EmployeeId}}</strong>), hereinafter referred to as the <em>Employee / Intern</em>.</p>

<h3>1. Position & Role</h3>
<p><strong>Designation / Role:</strong> {{Designation}}</p>
<p><strong>Department:</strong> {{Department}}</p>
<p><strong>Joined Date:</strong> {{JoinDate}}</p>

<h3>2. Compensation & Remuneration</h3>
<p><strong>Basic Salary / Allowance:</strong> {{Salary}}</p>

<h3>3. Terms & Conditions</h3>
<p>The Employee / Intern agrees to perform assigned tasks faithfully, observe company policies, maintain strict confidentiality of proprietary data, and protect intellectual property rights.</p>

<h3>4. Governing Law</h3>
<p>This agreement is governed by the laws of Sri Lanka.</p>

<p>__________________________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;__________________________</p>
<p><strong>${companyName}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>{{EmployeeName}}</strong></p>
<p>Company / Provider&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Employee / Intern</p>
<p>Date: ${today}</p>
    `.trim(),

    custom: buildCustomAgreementShell(companyName, companyAddress, companyPhone, companyEmail, clientName, today),
  };

  return templates[type] || templates.general;
}
