// routes/access.js — public file access (no login needed for recipients)
// The share link token is the proof of access.

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcryptjs');
const db      = require('../utils/db');
const { getDeviceType, getClientIp, isExpired } = require('../utils/helpers');

// Helper: get file record from DB by token (public, no user check)
function getFile(token) {
  return db.prepare('SELECT * FROM files WHERE token = ?').get(token);
}

// Helper: check if file is expired/limit-reached
function checkValid(f) {
  if (f.revoked) return { ok: false, error: 'Access has been revoked', status: 403 };
  const expired = f.expires_at && new Date() > new Date(f.expires_at);
  if (expired) return { ok: false, error: 'File has expired', status: 410 };
  const limitReached = f.max_downloads && f.download_count >= f.max_downloads;
  if (limitReached) return { ok: false, error: 'Download limit reached', status: 410 };
  return { ok: true };
}

// POST /f/verify/:token — check password
router.post('/verify/:token', async (req, res) => {
  const f = getFile(req.params.token);
  if (!f) return res.status(404).json({ error: 'File not found' });

  const check = checkValid(f);
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  if (!f.has_password) return res.json({ verified: true });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const match = await bcrypt.compare(password, f.password_hash);
  if (!match) return res.status(401).json({ error: 'Incorrect password' });

  res.json({ verified: true });
});

// POST /f/download/:token — download the file
router.post('/download/:token', async (req, res) => {
  const f = getFile(req.params.token);
  if (!f) return res.status(404).json({ error: 'File not found' });

  const check = checkValid(f);
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  // Password check
  if (f.has_password) {
    const { password } = req.body;
    if (!password) return res.status(401).json({ error: 'Password required' });
    const match = await bcrypt.compare(password, f.password_hash);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });
  }

  const { reason } = req.body;
  const validReasons = ['official', 'work', 'study', 'personal', 'research', 'other'];
  if (!reason || !validReasons.includes(reason)) {
    return res.status(400).json({ error: 'A valid access reason is required' });
  }

  if (f.access_type && reason !== f.access_type) {
    return res.status(403).json({
      error: `Access denied. This file is for "${f.access_type}" use only. You selected "${reason}".`,
      requiredAccessType: f.access_type,
    });
  }

  const filePath = path.join(__dirname, '../uploads', f.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File no longer exists on server' });
  }

  // Write access log to SQLite (linked to the uploader so they can see it in their dashboard)
  db.prepare(`
    INSERT INTO access_logs (file_token, uploader_id, ip_address, device_type, reason, action)
    VALUES (?, ?, ?, ?, ?, 'download')
  `).run(
    f.token,
    f.uploader_id,
    getClientIp(req),
    getDeviceType(req.headers['user-agent'])
  );

  // Increment download count
  db.prepare('UPDATE files SET download_count = download_count + 1 WHERE token = ?').run(f.token);

  // Self-destruct: revoke after download
  if (f.self_destruct) {
    db.prepare('UPDATE files SET revoked = 1 WHERE token = ?').run(f.token);
  }

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.original_name)}"`);
  res.setHeader('Content-Type', f.mimetype || 'application/octet-stream');
  res.setHeader('Content-Length', f.size);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
  fileStream.on('error', (err) => {
    console.error('File stream error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
  });
});

// GET /f/preview/:token — preview info (public)
router.get('/preview/:token', (req, res) => {
  const f = getFile(req.params.token);
  if (!f) return res.status(404).json({ error: 'File not found' });
  if (!f.preview_enabled) return res.status(403).json({ error: 'Preview not enabled' });

  res.json({
    name: f.original_name,
    size: f.size,
    mimetype: f.mimetype,
    previewEnabled: true,
  });
});

module.exports = router;
