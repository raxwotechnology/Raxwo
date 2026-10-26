/**
 * smsService.js
 * Central SMS notification system for Raxwo ERP
 * Includes template management
 */
const axios = require('axios');
const SmsLog = require('../models/SmsLog');
const Employee = require('../models/Employee');

const SMSLENZ_URL = 'https://www.smslenz.lk/api';
const SMSLENZ_USER_ID = process.env.SMSLENZ_USER_ID || '157';
const SMSLENZ_API_KEY = process.env.SMSLENZ_API_KEY || '31396018-0f04-47ab-b9a8-60b2f55a8e2c';
const SMSLENZ_SENDER_ID = process.env.SMSLENZ_SENDER_ID || 'Raxwo';

const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let formatted = phone.replace(/[^0-9]/g, '');
  if (formatted.startsWith('0')) formatted = '94' + formatted.substring(1);
  else if (formatted.startsWith('94') && formatted.length === 11) {} 
  else if (formatted.length === 9) formatted = '94' + formatted;
  if (formatted.length >= 11) return formatted;
  return null;
};

const sendSms = async (phone, message, recipientName = 'Unknown', module = 'system') => {
  const formattedPhone = formatPhoneNumber(phone);
  if (!formattedPhone) {
    console.log(`[SMS] Invalid phone number for ${recipientName}: ${phone}`);
    return false;
  }
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    
    const url = `${SMSLENZ_URL}/send-sms`;
    const payload = {
      user_id: SMSLENZ_USER_ID,
      api_key: SMSLENZ_API_KEY,
      sender_id: SMSLENZ_SENDER_ID,
      contact: formattedPhone,
      message: message
    };

    const response = await axios.post(url, payload, { httpsAgent: agent });
    const resData = response.data;

    // SMSLenz returns { error: true, success: false, message: '...' } on failure
    // even with HTTP 200. We must check the response body.
    if (resData?.error === true || resData?.success === false) {
      const errorMsg = resData?.message || 'API rejected the request';
      console.error(`[SMS] API error for ${recipientName} (${formattedPhone}): ${errorMsg}`);
      await SmsLog.create({ recipientName, recipientPhone: formattedPhone, message, module, status: 'failed', response: errorMsg });
      return false;
    }

    await SmsLog.create({ recipientName, recipientPhone: formattedPhone, message, module, status: 'sent', response: resData });
    console.log(`[SMS] Sent successfully to ${recipientName} (${formattedPhone})`);
    return true;
  } catch (error) {
    console.error(`[SMS] Failed to send to ${formattedPhone}:`, error.message);
    await SmsLog.create({ recipientName, recipientPhone: formattedPhone, message, module, status: 'failed', response: error.message });
    return false;
  }
};

/* ─── Standardized Notification Templates ──────────────────────────────────────── */

exports.sendClientWelcomeSms = async (phone, name, email, password) => {
  const msg = `Welcome to Raxwo ${name}! Login: ${email} | Password: ${password}. Please login to your portal and change your password.`;
  return sendSms(phone, msg, name, 'auth');
};

exports.sendProjectAssignedClientSms = async (phone, name, title) => {
  const msg = `Hi ${name}, your project "${title}" has been successfully initiated. Track its progress on your Raxwo Client Portal.`;
  return sendSms(phone, msg, name, 'project');
};

exports.sendProjectAssignedEmployeeSms = async (phone, name, title) => {
  const msg = `Hi ${name}, you have been assigned to project "${title}". Please check your developer dashboard for more details.`;
  return sendSms(phone, msg, name, 'project');
};

exports.sendInvoiceSms = async (phone, name, invoiceNo, amount, dueDate, invoiceId) => {
  const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/payments?invoice=${invoiceId}`;
  const msg = `Hi ${name}, invoice ${invoiceNo} for LKR ${Number(amount).toLocaleString()} has been generated. Due by ${new Date(dueDate).toLocaleDateString()}. View: ${link}`;
  return sendSms(phone, msg, name, 'invoice');
};

exports.sendQuotationSms = async (phone, name, quotationNo, amount, quotationId) => {
  const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/my-account?quotation=${quotationId}`;
  const msg = `Hi ${name}, quotation ${quotationNo} for LKR ${Number(amount).toLocaleString()} is ready for your review. View: ${link}`;
  return sendSms(phone, msg, name, 'quotation');
};

exports.sendQuotationLinkSms = async (phone, name, quotationNo, shareLink) => {
  const msg = `Hi ${name}, your quotation ${quotationNo} is ready. View it here: ${shareLink}`;
  return sendSms(phone, msg, name, 'quotation');
};

exports.sendPayslipSms = async (phone, name, monthName, netSalary, billUrl) => {
  const link = billUrl || `${process.env.APP_URL || 'http://localhost:5173'}/developer/payslips`;
  const msg = `Hi ${name}, your salary for ${monthName} (LKR ${Number(netSalary).toLocaleString()}) has been processed. View your payment bill: ${link}`;
  return sendSms(phone, msg, name, 'payroll');
};

exports.sendSubscriptionPaymentReceiptSms = async (phone, name, subTitle, amount, nextDueDate) => {
  const dueStr = nextDueDate ? ` Next due: ${new Date(nextDueDate).toLocaleDateString('en-LK')}.` : '';
  const msg = `Dear ${name}, we have received your payment of LKR ${Number(amount).toLocaleString()} for subscription "${subTitle}".${dueStr} Thank you! - Raxwo`;
  return sendSms(phone, msg, name, 'payment');
};

exports.sendSubscriptionHistorySms = async (phone, name, subTitle, totalPaid) => {
  const msg = `Hi ${name}, payment history for your subscription "${subTitle}" has been generated. Total paid: LKR ${Number(totalPaid || 0).toLocaleString()}. View details in your portal.`;
  return sendSms(phone, msg, name, 'subscription');
};

exports.sendLeaveDecisionSms = async (phone, name, type, status) => {
  const msg = `Hi ${name}, your ${type} leave request has been ${status.toUpperCase()}.`;
  return sendSms(phone, msg, name, 'leave');
};

exports.sendSms = sendSms;
exports.formatPhoneNumber = formatPhoneNumber;
