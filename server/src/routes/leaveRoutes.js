const express = require('express');
const router = express.Router();
const {
  requestLeave, getLeaves, getMyLeaves, getMyBalances,
  updateLeaveStatus, assignLeave, getPolicies, createPolicy, updatePolicy,
  getEmployeeLeaveBalance, updateLeave, deleteLeave, deletePolicy, getPolicyForEmployee,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');
const { uploadDocument } = require('../middleware/upload');

// Employee
router.post('/', protect, uploadDocument, requestLeave);
router.get('/my', protect, getMyLeaves);
router.get('/my/balances', protect, getMyBalances);

// Admin / Manager
router.post('/assign', protect, authorize('admin', 'manager'), assignLeave);
router.get('/', protect, authorize('admin', 'manager'), getLeaves);
router.put('/:id/status', protect, authorize('admin', 'manager'), updateLeaveStatus);
router.put('/:id', protect, authorize('admin', 'manager'), updateLeave);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteLeave);
router.get('/balance/:employeeId', protect, authorize('admin', 'manager'), getEmployeeLeaveBalance);
router.get('/policy-for/:employeeId', protect, authorize('admin', 'manager'), getPolicyForEmployee);

// Leave Policies
router.get('/policies', protect, authorize('admin', 'manager'), getPolicies);
router.post('/policies', protect, authorize('admin', 'manager'), createPolicy);
router.put('/policies/:id', protect, authorize('admin', 'manager'), updatePolicy);
router.delete('/policies/:id', protect, authorize('admin', 'manager'), deletePolicy);

module.exports = router;
