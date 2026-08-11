const express = require('express');
const router = express.Router();
const { sendMail } = require('../utils/mailer');
const { uploadCV } = require('../middleware/upload');

// General Contact Inquiry Handler
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Missing required fields (name, email, message)' });
    }

    const html = `
      <h2>New Contact Inquiry Received</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
      <h3>Message:</h3>
      <p>${String(message).replace(/\n/g, '<br/>')}</p>
    `;

    const mailRes = await sendMail({
      to: 'raxwotechnology@gmail.com',
      subject: `Inquiry: ${subject || 'General Contact'} - ${name}`,
      html,
    });

    return res.json({ success: true, message: 'Inquiry received successfully' });
  } catch (error) {
    console.error('General Contact Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/apply', uploadCV, async (req, res) => {
  try {
    const { name, email, phone, position, resumeLink, message } = req.body;
    
    if (!name || !email || !position || !message) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const html = `
      <h2>New Job Application Received</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Position:</strong> ${position}</p>
      <p><strong>Resume/Portfolio Link:</strong> ${resumeLink || 'N/A'}</p>
      <h3>Cover Letter / Message:</h3>
      <p>${message.replace(/\n/g, '<br/>')}</p>
    `;

    const attachments = [];
    if (req.file && req.file.buffer) {
      attachments.push({
        filename: req.file.originalname || 'resume.pdf',
        content: req.file.buffer
      });
    }

    const mailRes = await sendMail({
      to: 'raxwotechnology@gmail.com',
      subject: `Job Application: ${position} - ${name}`,
      html,
      attachments,
    });

    if (mailRes.sent) {
      return res.json({ success: true, message: 'Application sent successfully' });
    } else {
      console.error('Email failed:', mailRes.error || mailRes.reason);
      return res.status(500).json({ success: false, message: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Contact Apply Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

