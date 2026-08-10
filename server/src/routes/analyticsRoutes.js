const express = require('express');
const router = express.Router();
const {
  getDashboard, getAdvancedAnalytics, getAIPredictions, auditWebsite,
  getNotifications, markRead, markSingleRead, getNotificationById,
  broadcastAnnouncement, sendBirthdayNotifications
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/dashboard', protect, authorize('admin', 'manager'), getDashboard);
router.get('/advanced', protect, authorize('admin', 'manager'), getAdvancedAnalytics);
router.get('/ai-predict', protect, authorize('admin', 'manager'), getAIPredictions);
router.post('/website-audit', protect, authorize('admin', 'manager'), auditWebsite);
router.get('/notifications', protect, getNotifications);
router.put('/notifications/read', protect, markRead);
router.get('/notifications/:id', protect, getNotificationById);
router.put('/notifications/:id/read', protect, markSingleRead);
router.post('/notifications/broadcast', protect, authorize('admin'), broadcastAnnouncement);
router.post('/notifications/birthdays', protect, authorize('admin'), sendBirthdayNotifications);

module.exports = router;
