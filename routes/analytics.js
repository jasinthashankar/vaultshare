// routes/analytics.js — stats scoped to the logged-in user only

const express     = require('express');
const router      = express.Router();
const requireAuth = require('../middleware/auth');
const db          = require('../utils/db');

router.use(requireAuth);

// GET /api/analytics/overview
router.get('/overview', (req, res) => {
  const uid = req.user.id;
  const now = new Date().toISOString();

  const totalFiles  = db.prepare('SELECT COUNT(*) as n FROM files WHERE uploader_id = ?').get(uid).n;
  const activeFiles = db.prepare(`
    SELECT COUNT(*) as n FROM files
    WHERE uploader_id = ? AND revoked = 0
      AND (expires_at IS NULL OR expires_at > ?)
      AND (max_downloads IS NULL OR download_count < max_downloads)
  `).get(uid, now).n;
  const revokedFiles       = db.prepare('SELECT COUNT(*) as n FROM files WHERE uploader_id = ? AND revoked = 1').get(uid).n;
  const passwordProtected  = db.prepare('SELECT COUNT(*) as n FROM files WHERE uploader_id = ? AND has_password = 1').get(uid).n;
  const selfDestructFiles  = db.prepare('SELECT COUNT(*) as n FROM files WHERE uploader_id = ? AND self_destruct = 1').get(uid).n;
  const totalDownloads     = db.prepare('SELECT SUM(download_count) as n FROM files WHERE uploader_id = ?').get(uid).n || 0;

  // Device breakdown from access_logs
  const deviceRows = db.prepare(`
    SELECT device_type, COUNT(*) as cnt FROM access_logs
    WHERE uploader_id = ? AND action = 'download'
    GROUP BY device_type
  `).all(uid);
  const deviceBreakdown = { desktop: 0, mobile: 0, tablet: 0 };
  deviceRows.forEach(r => { deviceBreakdown[r.device_type] = r.cnt; });

  // Reason breakdown
  const reasonRows = db.prepare(`
    SELECT reason, COUNT(*) as cnt FROM access_logs
    WHERE uploader_id = ? AND action = 'download'
    GROUP BY reason
  `).all(uid);
  const reasonBreakdown = { study: 0, work: 0, personal: 0, research: 0, other: 0 };
  reasonRows.forEach(r => { reasonBreakdown[r.reason] = r.cnt; });

  // Last 7 days download trend
  const downloadTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().split('T')[0];
    const cnt = db.prepare(`
      SELECT COUNT(*) as n FROM access_logs
      WHERE uploader_id = ? AND action = 'download'
        AND substr(accessed_at, 1, 10) = ?
    `).get(uid, day).n;
    downloadTrend.push({ date: day, count: cnt });
  }

  res.json({
    stats: {
      totalFiles,
      activeFiles,
      revokedFiles,
      passwordProtected,
      selfDestructFiles,
      totalDownloads,
      totalUploads: totalFiles,
    },
    deviceBreakdown,
    reasonBreakdown,
    downloadTrend,
  });
});

// GET /api/analytics/logs — only this user's file access logs
router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const token = req.query.token;

  let query  = 'SELECT * FROM access_logs WHERE uploader_id = ?';
  const args = [req.user.id];

  if (token) {
    query += ' AND file_token = ?';
    args.push(token);
  }

  query += ' ORDER BY accessed_at DESC LIMIT ?';
  args.push(limit);

  const logs = db.prepare(query).all(...args);

  // Rename fields to match old format the frontend expects
  const formatted = logs.map(l => ({
    token:     l.file_token,
    ip:        l.ip_address,
    device:    l.device_type,
    reason:    l.reason,
    action:    l.action,
    timestamp: l.accessed_at,
  }));

  res.json({ logs: formatted });
});

module.exports = router;
