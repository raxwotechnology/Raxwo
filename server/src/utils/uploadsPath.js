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

function saveBase64ImageFile(dataUri, subdir = 'avatars', prefix = 'img') {
  if (!dataUri || typeof dataUri !== 'string') return '';
  if (!dataUri.startsWith('data:image/')) return toRelativeUploadUrl(dataUri);
  try {
    const match = dataUri.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!match) return dataUri;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const targetDir = uploadSubdir(subdir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${subdir}/${filename}`;
  } catch (e) {
    console.error('Failed to save base64 image file:', e.message);
    return dataUri;
  }
}

/** Store only `/uploads/...` in the database so any API host works with mediaUrl(). */
function toRelativeUploadUrl(urlOrPath, subdir = 'avatars') {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '';
  let trimmed = urlOrPath.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return saveBase64ImageFile(trimmed, subdir);
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
  saveBase64ImageFile,
};
