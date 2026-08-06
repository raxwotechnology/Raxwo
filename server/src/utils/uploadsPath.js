const path = require('path');
const fs = require('fs');

/** Stable uploads root (Hostinger cwd may differ from the server package). */
function getUploadsRoot() {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }
  return path.resolve(__dirname, '../../uploads');
}

function ensureUploadSubdirs(subs = ['documents', 'images', 'cvs', 'agreements', 'bills', 'worklogs', 'requests']) {
  const root = getUploadsRoot();
  subs.forEach((sub) => {
    fs.mkdirSync(path.join(root, sub), { recursive: true });
  });
  return root;
}

function uploadSubdir(name) {
  return path.join(getUploadsRoot(), name);
}

/** Store only `/uploads/...` in the database so any API host works with mediaUrl(). */
function toRelativeUploadUrl(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '';
  let trimmed = urlOrPath.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  trimmed = trimmed.replace(/\\/g, '/');

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      if (u.pathname.includes('/uploads/')) {
        return u.pathname.substring(u.pathname.indexOf('/uploads/'));
      }
    }
  } catch {
    /* ignore */
  }

  const idx = trimmed.indexOf('/uploads/');
  if (idx !== -1) return trimmed.substring(idx);

  const idx2 = trimmed.indexOf('uploads/');
  if (idx2 !== -1) return '/' + trimmed.substring(idx2);

  if (trimmed.startsWith('/')) return trimmed;
  return `/uploads/documents/${path.basename(trimmed)}`;
}

function relativeUploadPath(subdir, filename) {
  if (filename && filename.startsWith('data:')) return filename;
  return `/uploads/${subdir}/${filename}`;
}

module.exports = {
  getUploadsRoot,
  ensureUploadSubdirs,
  uploadSubdir,
  toRelativeUploadUrl,
  relativeUploadPath,
};
