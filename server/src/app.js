const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');

// Preload ALL Mongoose models dynamically so population registry is 100% complete
const modelsDir = path.join(__dirname, 'models');
if (fs.existsSync(modelsDir)) {
  fs.readdirSync(modelsDir).forEach((file) => {
    if (file.endsWith('.js')) {
      try { require(path.join(modelsDir, file)); } catch (e) {}
    }
  });
}

// Route imports
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const recruitmentRoutes = require('./routes/recruitmentRoutes');
const projectRoutes = require('./routes/projectRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const letterRoutes = require('./routes/letterRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const socialRoutes = require('./routes/socialRoutes');
const socialAssignmentRoutes = require('./routes/socialAssignmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const messageRoutes = require('./routes/messageRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const siteSettingRoutes = require('./routes/siteSettingRoutes');
const performanceRoutes = require('./routes/performanceRoutes');
const exportRoutes = require('./routes/exportRoutes');
const financeRoutes = require('./routes/financeRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const contentRoutes = require('./routes/contentRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const auditRoutes = require('./routes/auditRoutes');
const branchRoutes = require('./routes/branchRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const advanceRoutes = require('./routes/advanceRoutes');
const loanRoutes = require('./routes/loanRoutes');
const pettyCashRoutes = require('./routes/pettyCashRoutes');
const clientRoutes = require('./routes/clientRoutes');
const workLogRoutes = require('./routes/workLogRoutes');
const bonusRoutes = require('./routes/bonusRoutes');
const agreementRoutes = require('./routes/agreementRoutes');
const epfRecordRoutes = require('./routes/epfRecordRoutes');
const targetRoutes = require('./routes/targetRoutes');
const attendancePolicyRoutes = require('./routes/attendancePolicyRoutes');
const requestRoutes = require('./routes/requestRoutes');
const toolAssignmentRoutes = require('./routes/toolAssignmentRoutes');
const smsRoutes = require('./routes/smsRoutes');
const emailLogRoutes = require('./routes/emailLogRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const { ensureDefaultRules } = require('./services/rewardService');

const app = express();
app.set('trust proxy', 1);

// Security & Universal CORS middleware
app.use(helmet({ crossOriginResourcePolicy: false, crossOriginOpenerPolicy: false }));

// Universal CORS middleware ensuring Access-Control headers on ALL responses (including errors & preflights)
app.use((req, res, next) => {
  const origin = req.headers.origin || 'https://manage.raxwo.net';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});



// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Ensure upload directories exist ──────────────────────────────────────────
const { ensureUploadSubdirs, getUploadsRoot } = require('./utils/uploadsPath');
const UPLOADS_ROOT = ensureUploadSubdirs();
console.log(`📁 Uploads directory: ${UPLOADS_ROOT}`);

// Static files — serve /uploads/** from the server uploads folder
// Use etag + short max-age with must-revalidate so images recover after temporary failures
app.use('/uploads', express.static(UPLOADS_ROOT, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  fallthrough: true,
}));

// If an upload is missing, return 404 with no-cache so it can recover when re-uploaded
app.use('/uploads', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(404).send(`
    <html>
      <head><title>File Not Found</title></head>
      <body style="font-family: system-ui, sans-serif; text-align: center; padding: 50px;">
        <h2>File Not Found</h2>
        <p>The requested file could not be found on the server. It may have been removed or not uploaded correctly.</p>
      </body>
    </html>
  `);
});

// ── Diagnostic endpoint (unauthenticated, read-only) ─────────────────────────
// Visit https://backend.raxwo.net/api/debug/uploads to inspect file storage
app.get('/api/debug/uploads', (req, res) => {
  try {
    const uploadsRoot = getUploadsRoot();
    const docsDir = path.join(uploadsRoot, 'documents');
    let files = [];
    let canWrite = false;
    try {
      files = fs.readdirSync(docsDir).slice(0, 50); // list up to 50 files
    } catch (e) { files = [`ERROR reading dir: ${e.message}`]; }
    try {
      const testFile = path.join(docsDir, `_write_test_${Date.now()}.tmp`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      canWrite = true;
    } catch (e) { canWrite = false; }
    res.json({
      uploadsRoot,
      docsDir,
      canWrite,
      fileCount: files.length,
      files,
      cwd: process.cwd(),
      __dirname: __dirname,
      env_UPLOADS_DIR: process.env.UPLOADS_DIR || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system-metrics', analyticsRoutes); // Alias for Adblocker
app.use('/api/social', socialRoutes);
app.use('/api/platform-data', socialRoutes); // Alias for Adblocker
app.use('/api/social-assignments', socialAssignmentRoutes);
app.use('/api/platform-assignments', socialAssignmentRoutes); // Alias for Adblocker
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/site-settings', siteSettingRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/advances', advanceRoutes);
app.use('/api/lookups', require('./routes/lookupRoutes'));
app.use('/api/loans', loanRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-logs', workLogRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/epf-records', epfRecordRoutes);
app.use('/api/bank-accounts', require('./routes/bankAccountRoutes'));
app.use('/api/cheques', require('./routes/chequeRoutes'));
app.use('/api/income-tax', require('./routes/incomeTaxRoutes'));
app.use('/api/targets', targetRoutes);
app.use('/api/attendance-policies', attendancePolicyRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/tool-assignments', toolAssignmentRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/email-logs', emailLogRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/leaders', require('./routes/leaderRoutes'));
app.use('/api/signature-requests', require('./routes/signatureRequestRoutes'));

ensureDefaultRules().catch(() => {});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Raxwo API is running', timestamp: new Date().toISOString() });
});

// Serve client build if available (for single-domain or proxy deployments)
const possibleDistPaths = [
  process.env.DIST_PATH,
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(__dirname, '../../../client/dist'),
  path.resolve(__dirname, '../../dist'),
  path.resolve(__dirname, '../dist'),
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../../public'),
  path.resolve(__dirname, '../../public_html'),
  path.resolve(__dirname, '../../../public_html'),
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '../..'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'dist'),
  path.resolve(process.cwd(), '../dist'),
  path.resolve(process.cwd(), 'public'),
  path.resolve(process.cwd(), 'public_html'),
  path.resolve(process.cwd(), '../public_html'),
  path.resolve(process.cwd(), '../../public_html'),
  path.resolve(process.cwd()),
].filter(Boolean);

let distDir = possibleDistPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (distDir) {
  console.log(`🎨 Serving React Frontend static build from: ${distDir}`);
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  console.log(`⚠️ React Frontend dist directory not found in: ${possibleDistPaths.join(', ')}`);
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
      return res.status(404).json({ success: false, message: `API Route ${req.originalUrl} not found` });
    }
    // If client URL is configured differently, offer HTML redirect page
    const clientUrl = process.env.CLIENT_URL || '';
    if (clientUrl && !clientUrl.includes(req.headers.host || '')) {
      return res.redirect(clientUrl);
    }
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Raxwo API Server & Portal Status</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
            .card { background: #1e293b; border: 1px solid #334155; padding: 32px; max-width: 480px; width: 100%; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            h1 { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px; }
            p { font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
            .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 12px; transition: all 0.2s; }
            .btn:hover { background: #1d4ed8; }
            .status { font-family: monospace; font-size: 11px; background: #0f172a; color: #38bdf8; padding: 6px 12px; border-radius: 8px; margin-top: 20px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Raxwo Management System</h1>
            <p>The backend API server is online. If you are accessing the management portal, please deploy the <code>client/dist</code> build folder into your hosting web root.</p>
            ${clientUrl ? `<a href="${clientUrl}" class="btn">Open Web App Portal &rarr;</a>` : ''}
            <br/>
            <div class="status">&bull; API Online &bull; ${new Date().toISOString()}</div>
          </div>
        </body>
      </html>
    `);
  });
}

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handler
app.use(errorHandler);

module.exports = app;
