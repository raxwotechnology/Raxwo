const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['leave', 'payroll', 'project', 'recruitment', 'payment', 'system', 'letter', 'attendance', 'booking', 'birthday', 'reward', 'voucher', 'referral', 'subscription', 'hosting', 'domain', 'financial', 'quotation', 'invoice'],
    default: 'system'
  },
  link: String,
  read: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
