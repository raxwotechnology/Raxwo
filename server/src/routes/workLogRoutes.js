const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const workLogController = require('../controllers/workLogController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getUploadsRoot } = require('../utils/uploadsPath');

// Multer storage for worklog files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(getUploadsRoot(), 'worklogs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `wl-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|zip/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) return cb(null, true);
    cb(new Error('File type not allowed'));
  }
});

router.use(protect);

// Employee routes — with file upload support
router.post('/my',
  authorize('developer', 'designer', 'marketing', 'manager', 'admin'),
  upload.fields([{ name: 'screenshots', maxCount: 5 }, { name: 'attachments', maxCount: 3 }]),
  workLogController.submitWorkLog
);
router.get('/my', authorize('developer', 'designer', 'marketing', 'manager', 'admin'), workLogController.getMyWorkLogs);

// Admin/Manager routes
router.get('/', authorize('admin', 'manager'), workLogController.getAllWorkLogs);
router.put('/bulk-approve', authorize('admin', 'manager'), workLogController.bulkApproveWorkLogs);
router.post('/:id/comments', authorize('admin', 'manager'), workLogController.addComment);
router.put('/:id/status', authorize('admin', 'manager'), workLogController.updateStatus);
router.put('/:id/approve', authorize('admin', 'manager'), workLogController.approveWorkLog);

module.exports = router;
