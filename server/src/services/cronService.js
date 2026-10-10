const cron = require('node-cron');
const Message = require('../models/Message');
const SiteSetting = require('../models/SiteSetting');
const subscriptionController = require('../controllers/subscriptionController');

// Run every day at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const settings = await SiteSetting.findOne();
    if (settings && settings.messageAutoDeleteDays && settings.messageAutoDeleteDays > 0) {
      const days = settings.messageAutoDeleteDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await Message.deleteMany({ createdAt: { $lt: cutoffDate } });
      if (result.deletedCount > 0) {
        console.log(`[CRON] Auto-deleted ${result.deletedCount} messages older than ${days} days.`);
      }
    }
  } catch (err) {
    console.error('[CRON Error] Failed to auto-delete messages:', err);
  }

  // Auto-process subscription billing / overdue statuses
  try {
    await subscriptionController.processOverdue();
    console.log('[CRON] Subscription overdue and billing check completed.');
  } catch (err) {
    console.error('[CRON Error] Failed to process subscription overdue:', err);
  }
});

// Run once on server startup after 10 seconds
setTimeout(async () => {
  try {
    await subscriptionController.processOverdue();
  } catch (err) {
    console.error('[Startup Subscription Check Error]:', err);
  }
}, 10000);

