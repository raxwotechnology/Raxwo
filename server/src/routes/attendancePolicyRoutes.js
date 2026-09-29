const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getPolicies, createPolicy, updatePolicy, deletePolicy } = require('../controllers/attendancePolicyController');

router.get('/',       protect, authorize('admin', 'manager'), getPolicies);
router.post('/',      protect, authorize('admin', 'manager'), createPolicy);
router.put('/:id',    protect, authorize('admin', 'manager'), updatePolicy);
router.delete('/:id', protect, authorize('admin', 'manager'), deletePolicy);

module.exports = router;
