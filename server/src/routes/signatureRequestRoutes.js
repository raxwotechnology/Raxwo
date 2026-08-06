const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadFile, uploadImageLocal } = require('../middleware/upload');
const controller = require('../controllers/signatureRequestController');

// 1. Get saved signature and seal stamps for logged in Admin/Owner
router.get('/stamps', protect, controller.getSavedStamps);

// 2. Save/update signature and seal stamps
router.post(
  '/stamps',
  protect,
  authorize('admin', 'owner', 'manager'),
  uploadImageLocal,
  controller.saveStamps
);

// Saved Stamp Library Routes
router.get('/saved-stamps', protect, controller.getSavedStampsList);
router.post('/saved-stamps', protect, authorize('admin', 'owner', 'manager'), uploadImageLocal, controller.createSavedStamp);
router.put('/saved-stamps/:id', protect, authorize('admin', 'owner', 'manager'), uploadImageLocal, controller.updateSavedStamp);
router.delete('/saved-stamps/:id', protect, authorize('admin', 'owner', 'manager'), controller.deleteSavedStamp);

// 3. Create a new Signature Request (Employee / Intern)
router.post(
  '/',
  protect,
  (req, res, next) => {
    uploadFile(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  controller.createRequest
);

// 4. Get Signature Requests (Filtered)
router.get('/', protect, controller.getRequests);

// 5. Get Single Request Details
router.get('/:id', protect, controller.getRequestById);

// 6. Sign and finalize request (Admin / Owner)
router.put(
  '/:id/sign',
  protect,
  authorize('admin', 'owner', 'manager'),
  (req, res, next) => {
    uploadFile(req, res, (err) => {
      if (err && err.code !== 'LIMIT_UNEXPECTED_FILE') {
        // file upload optional if sending base64 signedDocUrl
      }
      next();
    });
  },
  controller.signAndFinalize
);

// 7. Reject signature request (Admin / Owner)
router.put(
  '/:id/reject',
  protect,
  authorize('admin', 'owner', 'manager'),
  controller.rejectRequest
);

module.exports = router;
