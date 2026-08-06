const SignatureRequest = require('../models/SignatureRequest');
const User = require('../models/User');
const Employee = require('../models/Employee');
const SiteSetting = require('../models/SiteSetting');
const { createNotification } = require('../services/notificationService');
const { sendMail } = require('../utils/mailer');
const { toRelativeUploadUrl } = require('../utils/uploadsPath');

// Helper to send email to user
async function sendNotificationEmail(toEmail, subject, textContent, htmlContent) {
  if (!toEmail) return;
  try {
    await sendMail({
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent
    });
  } catch (err) {
    console.error('[SignatureRequest Email Error]:', err.message);
  }
}

// 1. Create a new Signature Request (Employee / Intern)
exports.createRequest = async (req, res, next) => {
  try {
    const { title, documentType, reason, urgency, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Document Title is required' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason/Purpose for request is required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a document file' });
    }

    const docPath = toRelativeUploadUrl(req.file.path || req.file.filename);

    // Resolve employee details
    const emp = await Employee.findOne({ userId: req.user._id }).populate('userId', 'name email phone');
    const empName = req.user.name || (emp && emp.userId?.name) || 'Employee';
    const empEmail = req.user.email || (emp && emp.userId?.email) || '';
    const empPhone = emp?.mobile || emp?.phone || req.user.phone || '';
    const empType = emp?.employmentType || 'permanent';

    const sigReq = await SignatureRequest.create({
      requester: req.user._id,
      employeeId: emp?._id || null,
      employeeName: empName,
      employeeEmail: empEmail,
      employeePhone: empPhone,
      employeeType: empType,
      title: title.trim(),
      documentType: documentType || 'Other',
      reason: reason.trim(),
      urgency: urgency || 'normal',
      notes: notes ? notes.trim() : '',
      originalDocUrl: docPath,
      status: 'pending'
    });

    // Notify all Admins & Owners
    const adminUsers = await User.find({ role: { $in: ['admin', 'owner', 'manager'] } }).select('_id email name');
    
    for (const admin of adminUsers) {
      // In-app notification
      await createNotification({
        recipient: admin._id,
        title: `Signature Requested (${sigReq.requestRef})`,
        message: `${empName} requested signature/seal for "${sigReq.title}". Reason: ${sigReq.reason}`,
        type: 'system',
        link: '/signature-requests'
      });

      // Email notification
      if (admin.email) {
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #2563eb;">New Document Signature Request</h2>
            <p><strong>Employee:</strong> ${empName} (${empType})</p>
            <p><strong>Document Ref:</strong> ${sigReq.requestRef}</p>
            <p><strong>Title:</strong> ${sigReq.title}</p>
            <p><strong>Category:</strong> ${sigReq.documentType}</p>
            <p><strong>Reason:</strong> ${sigReq.reason}</p>
            <p><strong>Urgency:</strong> <span style="color: ${sigReq.urgency === 'urgent' ? '#dc2626' : '#2563eb'}; font-weight: bold;">${sigReq.urgency.toUpperCase()}</span></p>
            <br/>
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/signature-requests" 
               style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
               Review & Sign Document
            </a>
          </div>
        `;
        sendNotificationEmail(admin.email, `[Signature Request] ${sigReq.title} - ${empName}`, `New signature request from ${empName}`, html);
      }
    }

    res.status(201).json({ success: true, message: 'Signature request submitted successfully', request: sigReq });
  } catch (err) {
    next(err);
  }
};

// 2. Get Requests (With filters for Admin/Owner and scoped for Employees)
exports.getRequests = async (req, res, next) => {
  try {
    const { status, documentType, urgency, employeeId, signedBy, search, startDate, endDate } = req.query;
    const isManagement = ['admin', 'owner', 'manager'].includes(req.user.role);

    const query = {};

    if (!isManagement) {
      query.requester = req.user._id;
    } else {
      if (employeeId) query.employeeId = employeeId;
      if (signedBy) query.signedBy = signedBy;
    }

    if (status) query.status = status;
    if (documentType) query.documentType = documentType;
    if (urgency) query.urgency = urgency;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: regex },
        { reason: regex },
        { requestRef: regex },
        { employeeName: regex }
      ];
    }

    const requests = await SignatureRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('requester', 'name email avatar role')
      .populate('signedBy', 'name email role');

    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    next(err);
  }
};

// 3. Get Request Details by ID
exports.getRequestById = async (req, res, next) => {
  try {
    const sigReq = await SignatureRequest.findById(req.params.id)
      .populate('requester', 'name email avatar role')
      .populate('signedBy', 'name email role');

    if (!sigReq) {
      return res.status(404).json({ success: false, message: 'Signature request not found' });
    }

    const isOwner = sigReq.requester._id.toString() === req.user._id.toString();
    const isManagement = ['admin', 'owner', 'manager'].includes(req.user.role);

    if (!isOwner && !isManagement) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, request: sigReq });
  } catch (err) {
    next(err);
  }
};

// 4. Sign & Finalize Document (Admin / Owner)
exports.signAndFinalize = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { signedDocUrl, stampsMeta } = req.body;

    const sigReq = await SignatureRequest.findById(id);
    if (!sigReq) {
      return res.status(404).json({ success: false, message: 'Signature request not found' });
    }

    let finalSignedUrl = signedDocUrl;
    if (req.file) {
      finalSignedUrl = toRelativeUploadUrl(req.file.path || req.file.filename);
    }

    if (!finalSignedUrl) {
      return res.status(400).json({ success: false, message: 'Signed document file or URL is required' });
    }

    sigReq.signedDocUrl = finalSignedUrl;
    sigReq.status = 'signed';
    sigReq.signedBy = req.user._id;
    sigReq.signedByName = req.user.name;
    sigReq.signedByRole = req.user.role;
    sigReq.signedAt = new Date();
    if (stampsMeta) sigReq.stampsMeta = stampsMeta;

    await sigReq.save();

    // Trigger In-App Notif & SMS to Employee via notificationService
    const notifMsg = `Your document "${sigReq.title}" (${sigReq.requestRef}) has been signed and sealed by ${req.user.name}.`;
    await createNotification({
      recipient: sigReq.requester,
      title: 'Document Signed & Sealed!',
      message: notifMsg,
      type: 'system',
      link: '/signature-requests'
    });

    // Send Email to Employee
    if (sigReq.employeeEmail) {
      const downloadLink = `${process.env.APP_URL || 'http://localhost:5173'}/signature-requests`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #16a34a;">Your Document has been Signed & Sealed!</h2>
          <p>Dear <strong>${sigReq.employeeName}</strong>,</p>
          <p>Your document request <strong>"${sigReq.title}"</strong> (${sigReq.requestRef}) has been processed and officially signed by <strong>${req.user.name}</strong> (${req.user.role}).</p>
          <br/>
          <a href="${downloadLink}" 
             style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
             Download Signed Document
          </a>
        </div>
      `;
      sendNotificationEmail(sigReq.employeeEmail, `[Signed Document] ${sigReq.title}`, notifMsg, html);
    }

    res.json({ success: true, message: 'Document signed and finalized successfully', request: sigReq });
  } catch (err) {
    next(err);
  }
};

// 5. Reject Request (Admin / Owner)
exports.rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const sigReq = await SignatureRequest.findById(id);
    if (!sigReq) {
      return res.status(404).json({ success: false, message: 'Signature request not found' });
    }

    sigReq.status = 'rejected';
    sigReq.rejectionReason = rejectionReason || 'Request declined by administrator.';
    sigReq.signedBy = req.user._id;
    sigReq.signedByName = req.user.name;
    sigReq.signedByRole = req.user.role;
    sigReq.signedAt = new Date();

    await sigReq.save();

    // Notify Employee
    const notifMsg = `Your document request "${sigReq.title}" was declined. Reason: ${sigReq.rejectionReason}`;
    await createNotification({
      recipient: sigReq.requester,
      title: 'Signature Request Declined',
      message: notifMsg,
      type: 'system',
      link: '/signature-requests'
    });

    if (sigReq.employeeEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #dc2626;">Signature Request Declined</h2>
          <p>Dear <strong>${sigReq.employeeName}</strong>,</p>
          <p>Your document request <strong>"${sigReq.title}"</strong> (${sigReq.requestRef}) was reviewed and declined by <strong>${req.user.name}</strong>.</p>
          <p><strong>Reason:</strong> ${sigReq.rejectionReason}</p>
        </div>
      `;
      sendNotificationEmail(sigReq.employeeEmail, `[Signature Request Declined] ${sigReq.title}`, notifMsg, html);
    }

    res.json({ success: true, message: 'Request rejected', request: sigReq });
  } catch (err) {
    next(err);
  }
};

// 6. Get Saved Signature & Seal Stamps for Logged-in Admin / Owner
exports.getSavedStamps = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('signatureUrl sealUrl');
    const settings = await SiteSetting.findOne().lean();

    res.json({
      success: true,
      signatureUrl: user?.signatureUrl || settings?.signatures?.adminSignatureUrl || '',
      sealUrl: user?.sealUrl || settings?.sealUrl || ''
    });
  } catch (err) {
    next(err);
  }
};

// 7. Save Admin/Owner Signature & Seal Images
exports.saveStamps = async (req, res, next) => {
  try {
    const { signatureUrl, sealUrl } = req.body;
    const user = await User.findById(req.user._id);

    if (signatureUrl !== undefined) user.signatureUrl = signatureUrl;
    if (sealUrl !== undefined) user.sealUrl = sealUrl;

    if (req.files) {
      if (req.files.signature) {
        user.signatureUrl = toRelativeUploadUrl(req.files.signature[0].path || req.files.signature[0].filename);
      }
      if (req.files.seal) {
        user.sealUrl = toRelativeUploadUrl(req.files.seal[0].path || req.files.seal[0].filename);
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Signature and seal saved successfully',
      signatureUrl: user.signatureUrl,
      sealUrl: user.sealUrl
    });
  } catch (err) {
    next(err);
  }
};
