// routes/files.js — all file routes now use SQLite + user isolation

const express   = require('express');
const router    = express.Router();
const path      = require('path');
const fs        = require('fs');
const bcrypt    = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const upload    = require('../middleware/upload');
const requireAuth = require('../middleware/auth');
const db        = require('../utils/db');
const { generateToken, formatBytes, getClientIp } = require('../utils/helpers');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads, please try again later.' }
});

// ALL file routes require login
router.use(requireAuth);

// POST /api/files/upload
router.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { password, expiryHours, maxDownloads, selfDestruct, previewEnabled, accessType } = req.body;

    const VALID_ACCESS_TYPES = ['official', 'work', 'study', 'personal', 'research', 'other'];
    if (!accessType || !VALID_ACCESS_TYPES.includes(accessType)) {
      return res.status(400).json({ error: 'Please select an access type for this file.' });
    }

    const token        = generateToken();
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    let expiresAt = null;
    if (expiryHours && parseInt(expiryHours) > 0) {
      expiresAt = new Date(Date.now() + parseInt(expiryHours) * 60 * 60 * 1000).toISOString();
    }

    db.prepare(`
      INSERT INTO files
        (token, uploader_id, original_name, filename, size, mimetype,
         expires_at, max_downloads, password_hash, self_destruct,
         preview_enabled, access_type, has_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token,
      req.user.id,
      req.file.originalname,
      req.file.filename,
      req.file.size,
      req.file.mimetype,
      expiresAt,
      maxDownloads ? parseInt(maxDownloads) : null,
      passwordHash,
      (selfDestruct === 'true' || selfDestruct === true) ? 1 : 0,
      (previewEnabled === 'true' || previewEnabled === true) ? 1 : 0,
      accessType,
      passwordHash ? 1 : 0
    );

    const shareLink = `${req.protocol}://${req.get('host')}/access/${token}`;

    res.json({
      success: true,
      token,
      shareLink,
      file: {
        name: req.file.originalname,
        size: formatBytes(req.file.size),
        type: req.file.mimetype,
        expiresAt,
        maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
        selfDestruct: selfDestruct === 'true',
        hasPassword: !!passwordHash,
        previewEnabled: previewEnabled === 'true',
        accessType,
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// GET /api/files/list — only shows THIS user's files
router.get('/list', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM files
    WHERE uploader_id = ?
    ORDER BY uploaded_at DESC
  `).all(req.user.id);

  const now = new Date();
  const files = rows.map(f => {
    const expired      = f.expires_at && now > new Date(f.expires_at);
    const limitReached = f.max_downloads && f.download_count >= f.max_downloads;
    return {
      token:         f.token,
      originalName:  f.original_name,
      size:          formatBytes(f.size),
      uploadedAt:    f.uploaded_at,
      expiresAt:     f.expires_at,
      maxDownloads:  f.max_downloads,
      downloadCount: f.download_count,
      selfDestruct:  !!f.self_destruct,
      hasPassword:   !!f.has_password,
      revoked:       !!f.revoked,
      active:        !f.revoked && !expired && !limitReached,
      accessType:    f.access_type,
    };
  });

  res.json({ files });
});

// GET /api/files/info/:token — owner only
router.get('/info/:token', (req, res) => {
  const f = db.prepare(
    'SELECT * FROM files WHERE token = ? AND uploader_id = ?'
  ).get(req.params.token, req.user.id);

  if (!f) return res.status(404).json({ error: 'File not found' });

  const expired      = f.expires_at && new Date() > new Date(f.expires_at);
  const limitReached = f.max_downloads && f.download_count >= f.max_downloads;

  res.json({
    token:          f.token,
    originalName:   f.original_name,
    size:           formatBytes(f.size),
    mimetype:       f.mimetype,
    uploadedAt:     f.uploaded_at,
    expiresAt:      f.expires_at,
    maxDownloads:   f.max_downloads,
    downloadCount:  f.download_count,
    selfDestruct:   !!f.self_destruct,
    hasPassword:    !!f.has_password,
    previewEnabled: !!f.preview_enabled,
    revoked:        !!f.revoked,
    expired,
    limitReached,
    active:         !f.revoked && !expired && !limitReached,
    accessType:     f.access_type,
  });
});

// POST /api/files/revoke/:token — owner only
router.post('/revoke/:token', (req, res) => {
  const f = db.prepare(
    'SELECT token FROM files WHERE token = ? AND uploader_id = ?'
  ).get(req.params.token, req.user.id);

  if (!f) return res.status(404).json({ error: 'File not found' });

  db.prepare('UPDATE files SET revoked = 1 WHERE token = ?').run(req.params.token);
  res.json({ success: true, message: 'Access revoked successfully' });
});

// POST /api/files/restore/:token — owner only
router.post('/restore/:token', (req, res) => {
  const f = db.prepare(
    'SELECT token FROM files WHERE token = ? AND uploader_id = ?'
  ).get(req.params.token, req.user.id);

  if (!f) return res.status(404).json({ error: 'File not found' });

  db.prepare('UPDATE files SET revoked = 0 WHERE token = ?').run(req.params.token);
  res.json({ success: true, message: 'Access restored successfully' });
});

// DELETE /api/files/:token — owner only
router.delete('/:token', (req, res) => {
  const f = db.prepare(
    'SELECT * FROM files WHERE token = ? AND uploader_id = ?'
  ).get(req.params.token, req.user.id);

  if (!f) return res.status(404).json({ error: 'File not found' });

  const filePath = path.join(__dirname, '../uploads', f.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM files WHERE token = ?').run(req.params.token);
  res.json({ success: true, message: 'File deleted permanently' });
});

module.exports = router;
