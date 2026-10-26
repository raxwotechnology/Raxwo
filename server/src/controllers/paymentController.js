const crypto = require('crypto');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Voucher = require('../models/Voucher');
const { validateVoucherForClient, awardPoints } = require('../services/rewardService');
const { createNotification } = require('../services/notificationService');

// @desc  Initiate PayHere payment
// @route POST /api/payments/payhere/init
exports.initiatePayment = async (req, res, next) => {
  try {
    const { invoiceId, itemId, itemType = 'invoice', voucherCode = '' } = req.body;
    const targetId = itemId || invoiceId;
    if (!targetId) return res.status(400).json({ success: false, message: 'Item ID required' });

    let targetItem, client, orderId, baseAmount;

    if (itemType === 'invoice') {
      targetItem = await Invoice.findById(targetId).populate('client', 'name email phone');
      if (!targetItem) return res.status(404).json({ success: false, message: 'Invoice not found' });
      if (targetItem.status === 'paid') return res.status(400).json({ success: false, message: 'Invoice already paid' });
      client = targetItem.client;
      orderId = targetItem.invoiceNo || targetItem._id.toString();
      baseAmount = Number(targetItem.total || 0);
    } else if (itemType === 'subscription') {
      const Subscription = require('../models/Subscription');
      targetItem = await Subscription.findById(targetId).populate('client', 'name email phone');
      if (!targetItem) return res.status(404).json({ success: false, message: 'Subscription not found' });
      client = targetItem.client;
      orderId = targetItem.subscriptionNo || targetItem._id.toString();
      baseAmount = Number(targetItem.remainingBalance || targetItem.amount || 0);
      if (baseAmount <= 0) return res.status(400).json({ success: false, message: 'No pending balance' });
    } else if (itemType === 'project') {
      const Project = require('../models/Project');
      targetItem = await Project.findById(targetId).populate('client', 'name email phone');
      if (!targetItem) return res.status(404).json({ success: false, message: 'Project not found' });
      client = targetItem.client;
      orderId = `PRJ-${targetItem._id.toString().substring(18)}`;
      baseAmount = Number(targetItem.budget || 0);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid item type' });
    }

    const merchantId  = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_SECRET;
    
    let discountAmount = 0;
    let finalAmountNum = baseAmount;
    let appliedVoucherCode = '';

    if (voucherCode && itemType === 'invoice') {
      const voucherValidation = await validateVoucherForClient({
        code: voucherCode,
        clientId: req.user._id,
        invoiceTotal: baseAmount,
      });
      if (!voucherValidation.valid) return res.status(400).json({ success: false, message: voucherValidation.message });
      discountAmount = Number(voucherValidation.discount || 0);
      finalAmountNum = Number(voucherValidation.finalAmount || baseAmount);
      appliedVoucherCode = voucherValidation.voucher.code;
    }

    const amount     = finalAmountNum.toFixed(2);
    const currency   = 'LKR';
    const sandbox    = process.env.PAYHERE_SANDBOX === 'true';

    // MD5 hash: merchantId + orderId + amount + currency + MD5(merchantSecret).toUpperCase()
    const secretHash  = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const rawHash     = `${merchantId}${orderId}${amount}${currency}${secretHash}`;
    const hash        = crypto.createHash('md5').update(rawHash).digest('hex').toUpperCase();

    // Create pending payment record
    const paymentData = {
      paymentType: itemType,
      client: client._id,
      amount: finalAmountNum,
      originalAmount: baseAmount,
      discountAmount,
      voucherCode: appliedVoucherCode,
      currency,
      payhere_order_id: orderId,
      status: 'pending',
    };
    if (itemType === 'invoice') paymentData.invoice = targetItem._id;
    if (itemType === 'subscription') paymentData.subscription = targetItem._id;
    if (itemType === 'project') paymentData.project = targetItem._id;

    const payment = await Payment.create(paymentData);

    res.json({
      success: true,
      paymentId: payment._id,
      paymentData: {
        sandbox,
        merchant_id:    merchantId,
        return_url:     `${process.env.CLIENT_URL}/payments?payment=success`,
        cancel_url:     `${process.env.CLIENT_URL}/payments?payment=cancelled`,
        notify_url:     `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payments/payhere/notify`,
        order_id:       orderId,
        items:          `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} ${orderId}`,
        amount,
        currency,
        first_name:     client.name ? client.name.split(' ')[0] : 'Client',
        last_name:      client.name ? client.name.split(' ').slice(1).join(' ') || '-' : '-',
        email:          client.email || 'no-email@raxwo.com',
        phone:          client.phone || '0000000000',
        address:        'Colombo',
        city:           'Colombo',
        country:        'Sri Lanka',
        hash,
        custom_1:       itemType,
        custom_2:       targetItem._id.toString(),
      },
      discountPreview: {
        originalAmount: baseAmount,
        discountAmount,
        finalAmount: finalAmountNum,
        voucherCode: appliedVoucherCode || null,
      },
    });
  } catch (err) { next(err); }
};

// @desc  Handle PayHere payment notification webhook
// @route POST /api/payments/payhere/notify
exports.payhereNotify = async (req, res, next) => {
  try {
    const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig, custom_1, custom_2, payment_id } = req.body;
    const merchantSecret = process.env.PAYHERE_SECRET;

    // Verify signature
    const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const rawHash    = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`;
    const localSig   = crypto.createHash('md5').update(rawHash).digest('hex').toUpperCase();

    if (localSig !== md5sig) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    if (status_code === '2') { // 2 = successful
      const itemType = custom_1 || 'invoice';
      const targetId = custom_2;
      let clientId = null;
      let title = '';
      let msg = '';

      if (itemType === 'invoice') {
        const invoice = await Invoice.findOne({ invoiceNo: order_id });
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date();
          await invoice.save();
          clientId = invoice.client;
          title = 'Payment Completed';
          msg = `Invoice ${invoice.invoiceNo} paid successfully.`;
          
          await awardPoints({
            userId: clientId,
            action: 'complete_invoice_payment',
            sourceKey: `invoice-paid:${invoice._id}`,
            note: 'Points for completed invoice payment',
          });
        }
      } else if (itemType === 'subscription') {
        const Subscription = require('../models/Subscription');
        const sub = await Subscription.findById(targetId).populate('client', 'name email phone');
        if (sub) {
          const amt = Number(payhere_amount);
          sub.totalPaid += amt;
          if (sub.totalPaid >= sub.totalBilled) {
            sub.status = 'active';
            sub.overdueDays = 0;
            const moment = require('moment');
            let nextDue = moment(sub.nextDueDate);
            if (nextDue.isBefore(moment())) nextDue = moment();
            sub.nextDueDate = nextDue.toDate();
          }
          sub.payments.push({
            amount: amt,
            method: 'payhere',
            reference: payment_id,
            note: `PayHere automatic payment`,
            paidAt: new Date(),
          });
          await sub.save();
          clientId = sub.client?._id || sub.client;
          title = 'Subscription Payment Completed';
          msg = `Payment of LKR ${amt.toLocaleString()} received for subscription ${sub.subscriptionNo}.`;

          // Automated Email Receipt
          if (sub.client?.email) {
            const { sendSubscriptionPaymentReceiptEmail } = require('../services/emailService');
            sendSubscriptionPaymentReceiptEmail(sub.client.email, sub.client.name, sub, {
              amount: amt,
              date: new Date(),
              method: 'payhere',
              reference: payment_id,
            }).catch(e => console.warn('[PayHere Subscription Receipt Email Failed]:', e.message));
          }

          // Automated SMS Receipt
          let clientPhone = sub.client?.phone;
          if (!clientPhone && sub.client?._id) {
            const ClientProfile = require('../models/ClientProfile');
            const cp = await ClientProfile.findOne({ userId: sub.client._id });
            clientPhone = cp?.phone || cp?.mobile;
          }
          if (clientPhone) {
            const { sendSubscriptionPaymentReceiptSms } = require('../services/smsService');
            sendSubscriptionPaymentReceiptSms(clientPhone, sub.client.name, sub.title, amt, sub.nextDueDate)
              .catch(e => console.warn('[PayHere Subscription Receipt SMS Failed]:', e.message));
          }
        }
      } else if (itemType === 'project') {
        const Project = require('../models/Project');
        const proj = await Project.findById(targetId);
        if (proj) {
          proj.paymentStatus = 'paid';
          await proj.save();
          clientId = proj.client;
          title = 'Project Payment Completed';
          msg = `Project ${proj.title} has been paid successfully.`;
        }
      }

      // Update generic payment record
      const payment = await Payment.findOneAndUpdate(
        { payhere_order_id: order_id },
        { status: 'completed', paidAt: new Date(), payhere_payment_id: payment_id, payhere_status_code: status_code, md5sig },
        { new: true }
      );

      if (payment?.voucherCode) {
        await Voucher.findOneAndUpdate(
          { code: payment.voucherCode },
          { $inc: { usedCount: 1 }, ...(payment.discountAmount > 0 ? { isActive: false } : {}) },
          { new: true }
        );
      }

      if (clientId) {
        await createNotification({
          recipient: clientId,
          title,
          message: msg + (payment?.discountAmount ? ` Voucher discount applied: LKR ${Number(payment.discountAmount).toLocaleString()}.` : ''),
          type: 'payment',
          link: '/payments',
        });
      }
    }
    res.send('OK');
  } catch (err) { next(err); }
};
