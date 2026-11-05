const Notification = require('../models/Notification');
const Employee = require('../models/Employee');
const { emitToUser } = require('../socket');
const { sendSms } = require('./smsService');

async function createNotification({
  recipient,
  title,
  message,
  type = 'system',
  link = '',
  sendSmsNotification = true,
  sendSms: explicitSendSms = true,
}) {
  if (!recipient || !title || !message) return null;
  const notif = await Notification.create({ recipient, title, message, type, link });
  emitToUser(recipient, 'notification:new', notif);

  if (sendSmsNotification === false || explicitSendSms === false) {
    return notif;
  }

  try {
    const SiteSetting = require('../models/SiteSetting');
    const settings = await SiteSetting.findOne();
    const smsEnabled = settings ? (settings.smsEnabled !== false) : true;
    
    if (smsEnabled) {
      // Map notification types to sms modules. Defaults to true if unknown.
      const mappedType = type === 'birthday' ? 'system' : type;
      const moduleEnabled = settings?.smsModules?.[mappedType] ?? true;

      if (moduleEnabled) {
        let phone = null;
        let recipientName = 'User';

        const emp = await Employee.findOne({ userId: recipient }).populate('userId', 'name role');
        // Do not auto-send SMS to managers or admins for internal system notifications
        if (emp?.userId && ['manager', 'admin'].includes(emp.userId.role)) {
          return notif;
        }

        if (emp && (emp.mobile || emp.phone)) {
          phone = emp.mobile || emp.phone;
          recipientName = emp.userId?.name || 'Employee';
        } else {
          const user = await require('../models/User').findById(recipient);
          if (user && ['manager', 'admin'].includes(user.role)) {
            return notif;
          }
          if (user && user.phone) {
            phone = user.phone;
            recipientName = user.name || 'Client';
          }
        }

        if (phone) {
          const smsMessage = `Raxwo ERP: ${title} - ${message}`;
          await sendSms(phone, smsMessage, recipientName, type);
        }
      }
    }
  } catch (error) {
    console.error('[SMS] Auto-notification error:', error.message);
  }

  return notif;
}

module.exports = { createNotification };
