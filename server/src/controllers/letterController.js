const Letter = require('../models/Letter');
const LetterTemplate = require('../models/LetterTemplate');
const Employee = require('../models/Employee');
const SiteSetting = require('../models/SiteSetting');
const { buildLetterBodyHtml } = require('../lib/letterTemplatesHtml');
const { createAuditLog } = require('./auditController');
const { createNotification } = require('../services/notificationService');
const { verifyActionPassword } = require('../utils/actionPassword');
const { toRelativeUploadUrl } = require('../utils/uploadsPath');
const { resolveEmployeeForUser } = require('../utils/employeeResolver');

function letterAuditSnapshot(doc) {
  if (!doc) return null;
  const c = doc.content != null ? String(doc.content) : '';
  return {
    title: doc.title,
    type: doc.type,
    approvalStatus: doc.approvalStatus,
    letterRef: doc.letterRef,
    contentLength: c.length,
    contentPreview: c.length > 400 ? `${c.slice(0, 400)}…` : c,
  };
}

async function getCompany() {
  const s = await SiteSetting.findOne().lean();
  const logo = s?.logoUrl ? toRelativeUploadUrl(s.logoUrl) : '';
  return {
    name: s?.siteName || 'Raxwo Pvt Ltd',
    logo,
    address: s?.contactAddress || 'Weliweriya, Sri Lanka',
    branchDetails: s?.branchDetails || '',
    email: s?.adminEmail || s?.contactEmail || 'hello@raxwo.com',
    adminEmail: s?.adminEmail || s?.contactEmail || '',
    contactEmail: s?.contactEmail || '',
    phone: s?.contactPhone || '',
    website: s?.websiteUrl || '',
    tagline: s?.siteDescription || '',
    footer: s?.footerText || '',
    seal: s?.sealUrl || '',
    signatures: s?.signatures || {},
  };
}

// ── Letter templates (saved HTML fragments) ─────────────────────────────────
exports.getLetterTemplates = async (req, res, next) => {
  try {
    const list = await LetterTemplate.find().sort({ updatedAt: -1 }).limit(80).populate('createdBy', 'name');
    res.json({ success: true, templates: list });
  } catch (err) { next(err); }
};

exports.createLetterTemplate = async (req, res, next) => {
  try {
    const { name, type, content, category, description, structuredData } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: 'Template name required' });
    const t = await LetterTemplate.create({
      name: name.trim(),
      type: type || 'custom',
      category: category || 'General',
      description: description || '',
      content: content || '',
      structuredData: structuredData || null,
      createdBy: req.user._id,
    });
    await createAuditLog({
      user: req.user,
      action: 'create',
      module: 'letters',
      entityId: String(t._id),
      entityName: t.name,
      description: `Letter template saved: "${t.name}"`,
      changes: {
        before: null,
        after: { name: t.name, type: t.type, contentLength: (t.content && String(t.content).length) || 0 },
      },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
    res.status(201).json({ success: true, template: t });
  } catch (err) { next(err); }
};

exports.deleteLetterTemplate = async (req, res, next) => {
  try {
    const pw = req.body?.password ?? req.query?.password;
    const check = await verifyActionPassword(req.user._id, pw);
    if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });

    const tpl = await LetterTemplate.findById(req.params.templateId).lean();
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' });

    await LetterTemplate.findByIdAndDelete(req.params.templateId);
    await createAuditLog({
      user: req.user,
      action: 'delete',
      module: 'letters',
      entityId: String(tpl._id),
      entityName: tpl.name,
      description: `Letter template deleted: "${tpl.name}"`,
      changes: { before: { name: tpl.name, type: tpl.type }, after: null },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
      severity: 'warning',
    });
    res.json({ success: true, message: 'Template removed' });
  } catch (err) { next(err); }
};

exports.duplicateLetterTemplate = async (req, res, next) => {
  try {
    const src = await LetterTemplate.findById(req.params.templateId).lean();
    if (!src) return res.status(404).json({ success: false, message: 'Template not found' });
    const copy = await LetterTemplate.create({
      name: `${src.name} (Copy)`,
      type: src.type || 'custom',
      category: src.category || 'General',
      description: src.description || '',
      content: src.content || '',
      structuredData: src.structuredData || null,
      createdBy: req.user._id,
    });
    await createAuditLog({
      user: req.user,
      action: 'create',
      module: 'letters',
      entityId: String(copy._id),
      entityName: copy.name,
      description: `Letter template duplicated: "${copy.name}"`,
      changes: { before: null, after: { name: copy.name, type: copy.type } },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
    res.status(201).json({ success: true, template: copy });
  } catch (err) { next(err); }
};

// @desc    Generate letter
// @route   POST /api/letters/generate
exports.generateLetter = async (req, res, next) => {
  try {
    const { employeeId, clientId, recipientType, type, data = {}, approvalStatus } = req.body;
    let employee = null;
    let client = null;
    
    if (recipientType === 'client') {
      if (clientId && clientId !== 'custom') {
        client = await require('../models/User').findById(clientId).select('name email phone');
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
      }
    } else {
      if (employeeId && employeeId !== 'custom') {
        employee = await Employee.findById(employeeId)
          .populate('userId', 'name email')
          .populate('branch', 'name')
          .populate('manager', 'name');
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
      }
    }

    const company = await getCompany();
    data.issuedByName = req.user.name;
    const typeLabels = {
      offer: 'Offer',
      appointment: 'Appointment',
      internship: 'Internship',
      contract: 'Contract',
      part_time: 'Part-Time',
      resignation: 'Resignation Acceptance',
      experience: 'Experience',
      salary: 'Salary Confirmation',
      confirmation: 'Employment Confirmation',
      service_agreement: 'Service Agreement',
      custom: data.title || data.letterTitle || 'Custom',
    };
    const title = data.title || `${typeLabels[type] || type}${employee ? ` — ${employee.userId.name}` : client ? ` — ${client.name}` : ''}`;

    // Pre-generate letterRef if not explicitly provided so content and structuredData get the actual ref
    let letterRef = data.letterRef;
    if (!letterRef || letterRef.includes('XXXX')) {
      const y = new Date().getFullYear();
      const count = await Letter.countDocuments();
      letterRef = `LTR-${y}-${String(count + 1).padStart(5, '0')}`;
    }

    let structuredData = data.structuredData || null;
    if (structuredData && typeof structuredData === 'object') {
      structuredData = { ...structuredData, letterRef };
    }

    let content = data.content ? data.content : buildLetterBodyHtml(type, employee || client || {}, data, company);
    if (content && typeof content === 'string') {
      content = content.replace(/LTR-\d{4}-XXXX/g, letterRef).replace(/LTR-XXXX/g, letterRef);
    }

    const letter = await Letter.create({
      recipientType: recipientType || 'employee',
      employee: employee ? employee._id : undefined,
      client: client ? client._id : undefined,
      type,
      title,
      content,
      letterRef,
      bodyFormat: 'html',
      issuedBy: req.user._id,
      approvalStatus: approvalStatus && ['none', 'pending', 'approved'].includes(approvalStatus) ? approvalStatus : 'none',
      structuredData,
      signatures: data.signatures || undefined,
    });

    const populated = await Letter.findById(letter._id)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } })
      .populate('client', 'name email')
      .populate('issuedBy', 'name');

    await createAuditLog({
      user: req.user,
      action: 'create',
      module: 'letters',
      entityId: String(letter._id),
      entityName: letter.letterRef || title,
      description: `Letter generated: ${title} (${type})${employee ? ` for ${employee.userId?.name}` : client ? ` for ${client.name}` : ' (External)'}`,
      changes: { before: null, after: letterAuditSnapshot(populated.toObject()) },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    if (employee && employee.userId) {
      await createNotification({
        recipient: employee.userId._id,
        title: 'New Letter Issued',
        message: `A new ${typeLabels[type] || type} letter has been issued to you.`,
        type: 'letter',
        link: '/employee/letters'
      });
    }

    res.status(201).json({ success: true, letter: populated });
  } catch (err) { next(err); }
};

// @desc    Get all letters
// @route   GET /api/letters
exports.getLetters = async (req, res, next) => {
  try {
    const { employeeId, clientId, type, recipientType } = req.query;
    const query = {};
    if (recipientType) query.recipientType = recipientType;
    if (employeeId) query.employee = employeeId;
    if (clientId) query.client = clientId;
    if (type) query.type = type;
    const letters = await Letter.find(query)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } })
      .populate('client', 'name email')
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: letters.length, letters });
  } catch (err) { next(err); }
};

// @desc    Get single letter
// @route   GET /api/letters/:id
exports.getLetter = async (req, res, next) => {
  try {
    const letter = await Letter.findById(req.params.id)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } })
      .populate('issuedBy', 'name');
    if (!letter) return res.status(404).json({ success: false, message: 'Letter not found' });
    res.json({ success: true, letter });
  } catch (err) { next(err); }
};

// @desc    Get my letters (employee)
// @route   GET /api/letters/my
exports.getMyLetters = async (req, res, next) => {
  try {
    const employee = await resolveEmployeeForUser(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const letters = await Letter.find({ employee: employee._id }).sort({ createdAt: -1 });
    res.json({ success: true, letters });
  } catch (err) { next(err); }
};

// @desc    Update letter content/details
// @route   PUT /api/letters/:id
exports.updateLetter = async (req, res, next) => {
  try {
    const prev = await Letter.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ success: false, message: 'Letter not found' });

    const { title, content, type, approvalStatus, signatures, structuredData } = req.body;
    const update = {
      ...(title ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(type ? { type } : {}),
      ...(approvalStatus && ['none', 'pending', 'approved'].includes(approvalStatus) ? { approvalStatus } : {}),
      ...(structuredData !== undefined ? { structuredData } : {}),
    };
    if (signatures && typeof signatures === 'object') {
      update.signatures = {
        activeRole: signatures.activeRole ?? signatures.selectedRole ?? prev.signatures?.activeRole ?? 'admin',
        includeSignature: signatures.includeSignature !== undefined ? signatures.includeSignature : (prev.signatures?.includeSignature !== false),
        includeSeal: signatures.includeSeal !== undefined ? signatures.includeSeal : (prev.signatures?.includeSeal !== false),
        signatory: { ...prev.signatures?.signatory, ...signatures.signatory },
        hr: { ...prev.signatures?.hr, ...signatures.hr },
        manager: { ...prev.signatures?.manager, ...signatures.manager },
        director: { ...prev.signatures?.director, ...signatures.director },
        seal: { ...prev.signatures?.seal, ...signatures.seal },
      };
    }
    const letter = await Letter.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } })
      .populate('issuedBy', 'name');
    if (!letter) return res.status(404).json({ success: false, message: 'Letter not found' });

    const afterDoc = letter.toObject ? letter.toObject() : letter;
    await createAuditLog({
      user: req.user,
      action: 'update',
      module: 'letters',
      entityId: String(letter._id),
      entityName: letter.letterRef || letter.title,
      description: `Letter updated: ${letter.title}`,
      changes: { before: letterAuditSnapshot(prev), after: letterAuditSnapshot(afterDoc) },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({ success: true, letter });
  } catch (err) { next(err); }
};

// @desc    Delete issued letter
// @route   DELETE /api/letters/:id
exports.deleteLetter = async (req, res, next) => {
  try {
    const pw = req.body?.password ?? req.query?.password;
    const check = await verifyActionPassword(req.user._id, pw);
    if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });

    const prev = await Letter.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ success: false, message: 'Letter not found' });

    await Letter.findByIdAndDelete(req.params.id);
    await createAuditLog({
      user: req.user,
      action: 'delete',
      module: 'letters',
      entityId: String(prev._id),
      entityName: prev.letterRef || prev.title,
      description: `Letter deleted: ${prev.title}`,
      changes: { before: letterAuditSnapshot(prev), after: null },
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
      severity: 'warning',
    });

    res.json({ success: true, message: 'Letter deleted' });
  } catch (err) { next(err); }
};

// @desc    Get company branding for letters
// @route   GET /api/letters/company-info
exports.getCompanyInfo = async (req, res, next) => {
  try {
    const company = await getCompany();
    res.json({ success: true, company });
  } catch (err) { next(err); }
};

// @desc    Generate PDF from HTML content (for crisp vector letters)
// @route   POST /api/letters/generate-pdf
exports.generateLetterPdf = async (req, res, next) => {
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
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'letter'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};
