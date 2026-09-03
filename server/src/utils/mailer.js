const nodemailer = require('nodemailer');

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (!smtpConfigured()) {
    console.warn('[Mailer] SMTP not configured — SMTP_HOST, SMTP_USER, SMTP_PASS must be set in .env');
    return null;
  }
  // Always strip any whitespace from app passwords (Gmail format: "xxxx xxxx xxxx xxxx")
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
}

async function sendMail({ to, subject, html, text, from: fromOverride, attachments }) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS in .env)' };
  }
  const smtpUser = process.env.SMTP_USER || 'raxwotechnology@gmail.com';
  const from = fromOverride || `"Raxwo Technology" <${smtpUser}>`;
  const replyTo = process.env.REPLY_TO || 'contact@raxwo.net';
  console.log(`[Mailer] Attempting to send to: ${to}, subject: ${subject}, from: ${from}`);
  try {
    await transport.sendMail({ from, replyTo, to, subject, html, text, attachments: attachments || undefined });
    return { sent: true };
  } catch (err) {
    console.error(`[Mailer] SMTP send error: ${err.message} (code: ${err.code})`);
    throw err;
  }
}

async function verifyConnection() {
  const transport = getTransport();
  if (!transport) return { ok: false, reason: 'SMTP not configured' };
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendMail, smtpConfigured, verifyConnection };
