const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadSubdir, getUploadsRoot } = require('../utils/uploadsPath');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Unified Base64 storage for all uploads (replaces ephemeral disk storage)
function Base64Storage() {}
Base64Storage.prototype._handleFile = function _handleFile(req, file, cb) {
  const chunks = [];
  file.stream.on('data', chunk => chunks.push(chunk));
  file.stream.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const b64 = buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${b64}`;
    cb(null, {
      filename: dataUri,  // req.file.filename
      path: dataUri,      // req.file.path  — keeps toRelativeUploadUrl() working
      buffer: buffer,
      size: buffer.length
    });
  });
  file.stream.on('error', cb);
};
Base64Storage.prototype._removeFile = function _removeFile(req, file, cb) { cb(null); };

const unifiedStorage = new Base64Storage();

const cvFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, DOC, DOCX files are allowed'), false);
};

exports.uploadCV = multer({
  storage: unifiedStorage,
  fileFilter: cvFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
}).single('cv');

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files allowed'), false);
};

exports.uploadImage = multer({
  storage: unifiedStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('avatar');

exports.uploadImageLocal = multer({
  storage: unifiedStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 4 * 1024 * 1024 }
}).single('image');

const agreementFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'), false);
};

exports.uploadAgreement = multer({
  storage: unifiedStorage,
  fileFilter: agreementFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('agreement');

const billFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, JPG, PNG, WEBP files are allowed'), false);
};

exports.uploadBill = multer({
  storage: unifiedStorage,
  fileFilter: billFilter,
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB
}).single('bill');

const docFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Unsupported file type'), false);
};

exports.uploadFile = multer({
  storage: unifiedStorage,
  fileFilter: docFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB – matches large PDF originals
}).single('file');

exports.uploadDocument = multer({
  storage: unifiedStorage,
  fileFilter: billFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('document');

exports.uploadLeaderPhoto = multer({
  storage: unifiedStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 3 * 1024 * 1024 } // 3MB
}).single('image');

exports.uploadSignedDocument = multer({
  storage: unifiedStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB – matches large PDF originals
}).single('file');

// ── Disk-based storage for Signature Request documents ────────────────────────
// Stores files as real files on disk (not base64 in DB) → no 34B corrupt downloads.
const sigDocDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(getUploadsRoot(), 'documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) ||
      (file.mimetype === 'application/pdf' ? '.pdf' : '.png');
    const name = `sigdoc_${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`;
    cb(null, name);
  }
});

const sigDocFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type for signature document'), false);
  }
};

/** Upload original document submitted with a signature request (saved to disk). */
exports.uploadSigOriginalDoc = multer({
  storage: sigDocDiskStorage,
  fileFilter: sigDocFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
}).single('file');

/** Upload the finalized signed document canvas PNG (saved to disk). */
exports.uploadSigSignedDoc = multer({
  storage: sigDocDiskStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
}).single('file');
