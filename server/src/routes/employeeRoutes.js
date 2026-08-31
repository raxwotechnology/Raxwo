const express = require('express');
const router = express.Router();
const {
  getEmployees, getPublicOurTeam, getEmployee, getMyProfile, createEmployee,
  updateEmployee, deleteEmployee, getStats, getEmployeeActivity,
  convertIntern, removeIntern,
  adminSetEmployeePassword, adminResetEmployeePassword, adminSendPasswordResetEmail,
  getLeadersSummary, assignLeader, designateLeader,
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');

router.get('/public-team', getPublicOurTeam);
router.get('/stats', protect, authorize('admin', 'manager'), getStats);
router.get('/leaders/summary', protect, authorize('admin', 'manager'), getLeadersSummary);
router.post('/assign-leader', protect, authorize('admin'), assignLeader);
router.post('/designate-leader', protect, authorize('admin'), designateLeader);
router.get('/me', protect, getMyProfile);
router.get('/', protect, authorize('admin', 'manager'), getEmployees);
router.get('/:id/activity', protect, authorize('admin', 'manager'), getEmployeeActivity);
router.put('/:id/password', protect, authorize('admin'), adminSetEmployeePassword);
router.post('/:id/reset-password', protect, authorize('admin'), adminResetEmployeePassword);
router.post('/:id/send-password-reset', protect, authorize('admin'), adminSendPasswordResetEmail);
router.get('/:id', protect, getEmployee);
router.post('/', protect, authorize('admin', 'manager'), createEmployee);
router.put('/:id/convert-intern', protect, authorize('admin'), convertIntern);
router.put('/:id/remove-intern', protect, authorize('admin'), removeIntern);
router.put('/:id', protect, authorize('admin', 'manager'), updateEmployee);
router.delete('/:id', protect, authorize('admin'), deleteEmployee);

module.exports = router;
