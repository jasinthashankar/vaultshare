// ============================================================
//  VaultShare — COMPLETE SERVER (single file, no external db)
// ============================================================
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer   = require('multer');
const session  = require('express-session');
const cors     = require('cors');
const morgan   = require('morgan');

const app    = express();
const PORT   = 3000;
const SECRET = 'vaultshare-jwt-secret-2024';

// ── Folders ──────────────────────────────────────────────────
const DATA_DIR    = path.join(__dirname, 'data');
const UPLOAD_DIR  = path.join(__dirname, 'uploads');
const DB_FILE     = path.join(DATA_DIR, 'vault.json');
[DATA_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true}); });

// ── JSON "database" ──────────────────────────────────────────
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users:[], files:[], logs:[] }; }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ── Multer (file upload) ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 100*1024*1024 } });

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret:'vs-session', resave:false, saveUninitialized:false }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ──────────────────────────────────────────
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error:'Login required' });
  try {
    req.user = jwt.verify(h.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error:'Session expired, please login again' });
  }
}

// ════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('\n[REGISTER] email:', email);

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const db = loadDB();
    const exists = db.users.find(u => u.email === email.toLowerCase().trim());
    if (exists) {
      console.log('[REGISTER] already exists');
      return res.status(409).json({ error: 'This email is already registered. Please login.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = { id: uuidv4(), email: email.toLowerCase().trim(), hash, createdAt: new Date().toISOString() };
    db.users.push(user);
    saveDB(db);

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
    console.log('[REGISTER] success for', user.email);
    res.json({ token, user: { id: user.id, email: user.email } });

  } catch(err) {
    console.error('[REGISTER] ERROR:', err);
    res.status(500).json({ error: 'Registration error: ' + err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('\n[LOGIN] email:', email);

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const db = loadDB();
    const user = db.users.find(u => u.email === email.toLowerCase().trim());
    if (!user) {
      console.log('[LOGIN] user not found');
      return res.status(401).json({ error: 'No account found with this email. Please register first.' });
    }

    const valid = await bcrypt.compare(password, user.hash);
    if (!valid) {
      console.log('[LOGIN] wrong password');
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
    console.log('[LOGIN] success for', user.email);
    res.json({ token, user: { id: user.id, email: user.email } });

  } catch(err) {
    console.error('[LOGIN] ERROR:', err);
    res.status(500).json({ error: 'Login error: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  FILE ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/files/upload
app.post('/api/files/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { password, expiryHours, maxDownloads, selfDestruct, previewEnabled, accessType } = req.body;

    const token      = uuidv4().replace(/-/g,'').slice(0,12);
    const passHash   = password ? await bcrypt.hash(password, 10) : null;
    const expiresAt  = expiryHours ? new Date(Date.now() + parseInt(expiryHours)*3600000).toISOString() : null;

    const record = {
      token, uploaderId: req.user.id,
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size, mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      expiresAt, maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
      downloadCount: 0, passwordHash: passHash,
      selfDestruct: selfDestruct === 'true',
      previewEnabled: previewEnabled === 'true',
      accessType: accessType || 'other',
      hasPassword: !!passHash, revoked: false
    };

    const db = loadDB();
    db.files.push(record);
    saveDB(db);

    const shareLink = `${req.protocol}://${req.get('host')}/access/${token}`;
    res.json({ success:true, token, shareLink, file: { name: req.file.originalname, size: req.file.size } });
  } catch(err) {
    console.error('[UPLOAD] ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/list  — only this user's files
app.get('/api/files/list', requireAuth, (req, res) => {
  const db = loadDB();
  const files = db.files.filter(f => f.uploaderId === req.user.id);
  res.json({ files });
});

// POST /api/files/revoke/:token
app.post('/api/files/revoke/:token', requireAuth, (req, res) => {
  const db = loadDB();
  const f  = db.files.find(f => f.token === req.params.token && f.uploaderId === req.user.id);
  if (!f) return res.status(404).json({ error: 'File not found' });
  f.revoked = true;
  saveDB(db);
  res.json({ success: true });
});

// POST /api/files/restore/:token
app.post('/api/files/restore/:token', requireAuth, (req, res) => {
  const db = loadDB();
  const f  = db.files.find(f => f.token === req.params.token && f.uploaderId === req.user.id);
  if (!f) return res.status(404).json({ error: 'File not found' });
  f.revoked = false;
  saveDB(db);
  res.json({ success: true });
});

// DELETE /api/files/:token
app.delete('/api/files/:token', requireAuth, (req, res) => {
  const db = loadDB();
  const idx = db.files.findIndex(f => f.token === req.params.token && f.uploaderId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'File not found' });
  const [f] = db.files.splice(idx, 1);
  const fp = path.join(UPLOAD_DIR, f.filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  saveDB(db);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  ANALYTICS ROUTES
// ════════════════════════════════════════════════════════════

app.get('/api/analytics/overview', requireAuth, (req, res) => {
  const db    = loadDB();
  const myFiles = db.files.filter(f => f.uploaderId === req.user.id);
  const myLogs  = db.logs.filter(l => l.uploaderId === req.user.id);
  const now     = new Date();

  const totalFiles     = myFiles.length;
  const activeFiles    = myFiles.filter(f => !f.revoked && (!f.expiresAt || new Date(f.expiresAt) > now)).length;
  const revokedFiles   = myFiles.filter(f => f.revoked).length;
  const totalDownloads = myFiles.reduce((s, f) => s + (f.downloadCount||0), 0);

  // Device breakdown
  const deviceBreakdown = { desktop:0, mobile:0, tablet:0 };
  myLogs.forEach(l => { if (deviceBreakdown[l.device] !== undefined) deviceBreakdown[l.device]++; });

  // Reason breakdown
  const reasonBreakdown = { study:0, work:0, personal:0, research:0, other:0 };
  myLogs.forEach(l => { if (reasonBreakdown[l.reason] !== undefined) reasonBreakdown[l.reason]++; });

  // Last 7 days trend
  const downloadTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const day = d.toISOString().split('T')[0];
    const count = myLogs.filter(l => l.action==='download' && l.accessedAt && l.accessedAt.startsWith(day)).length;
    downloadTrend.push({ date: day, count });
  }

  res.json({
    stats: { totalFiles, activeFiles, revokedFiles, totalDownloads,
             totalUploads: totalFiles, passwordProtected: myFiles.filter(f=>f.hasPassword).length,
             selfDestructFiles: myFiles.filter(f=>f.selfDestruct).length },
    deviceBreakdown, reasonBreakdown, downloadTrend
  });
});

app.get('/api/analytics/logs', requireAuth, (req, res) => {
  const db   = loadDB();
  const logs = db.logs.filter(l => l.uploaderId === req.user.id)
                      .slice(-50).reverse()
                      .map(l => ({ token:l.fileToken, ip:l.ip, device:l.device, reason:l.reason, action:l.action, timestamp:l.accessedAt }));
  res.json({ logs });
});

// ════════════════════════════════════════════════════════════
//  PUBLIC ACCESS ROUTES (no login needed for recipients)
// ════════════════════════════════════════════════════════════

// GET /f/info/:token — check if file is accessible
app.get('/f/info/:token', (req, res) => {
  const db = loadDB();
  const f  = db.files.find(f => f.token === req.params.token);
  if (!f) return res.status(404).json({ error: 'File not found or link is invalid' });

  const now = new Date();
  if (f.revoked) return res.status(403).json({ error: 'Access has been revoked by the owner' });
  if (f.expiresAt && now > new Date(f.expiresAt)) return res.status(410).json({ error: 'This link has expired' });
  if (f.maxDownloads && f.downloadCount >= f.maxDownloads) return res.status(410).json({ error: 'Download limit reached' });

  res.json({
    name: f.originalName, size: f.size, mimetype: f.mimetype,
    hasPassword: f.hasPassword, previewEnabled: f.previewEnabled,
    accessType: f.accessType, selfDestruct: f.selfDestruct
  });
});

// POST /f/download/:token — download file
app.post('/f/download/:token', async (req, res) => {
  const db = loadDB();
  const f  = db.files.find(f => f.token === req.params.token);
  if (!f) return res.status(404).json({ error: 'File not found' });

  const now = new Date();
  if (f.revoked) return res.status(403).json({ error: 'Access revoked' });
  if (f.expiresAt && now > new Date(f.expiresAt)) return res.status(410).json({ error: 'Link expired' });
  if (f.maxDownloads && f.downloadCount >= f.maxDownloads) return res.status(410).json({ error: 'Limit reached' });

  if (f.hasPassword) {
    const ok = await bcrypt.compare(req.body.password || '', f.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Incorrect password' });
  }

  if (!req.body.reason) return res.status(400).json({ error: 'Access reason required' });
  if (f.accessType && f.accessType !== 'other' && req.body.reason !== f.accessType)
    return res.status(403).json({ error: `This file is for "${f.accessType}" access only` });

  // Log access
  const ua = req.headers['user-agent'] || '';
  const device = /mobile|android|iphone/i.test(ua) ? 'mobile' : /tablet|ipad/i.test(ua) ? 'tablet' : 'desktop';
  db.logs.push({
    fileToken: f.token, uploaderId: f.uploaderId,
    ip: req.ip, device, reason: req.body.reason,
    action: 'download', accessedAt: new Date().toISOString()
  });

  f.downloadCount = (f.downloadCount || 0) + 1;
  if (f.selfDestruct) f.revoked = true;
  saveDB(db);

  const fp = path.join(UPLOAD_DIR, f.filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing from server' });

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.originalName)}"`);
  res.setHeader('Content-Type', f.mimetype || 'application/octet-stream');
  fs.createReadStream(fp).pipe(res);
});

// ════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  const db = loadDB();
  res.json({ status:'ok', users: db.users.length, files: db.files.length, time: new Date().toISOString() });
});

// ════════════════════════════════════════════════════════════
//  HTML PAGE ROUTES
// ════════════════════════════════════════════════════════════
app.get('/',              (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/login',         (req,res) => res.sendFile(path.join(__dirname,'public','login.html')));
app.get('/register',      (req,res) => res.sendFile(path.join(__dirname,'public','register.html')));
app.get('/dashboard',     (req,res) => res.sendFile(path.join(__dirname,'public','dashboard.html')));
app.get('/access/:token', (req,res) => res.sendFile(path.join(__dirname,'public','access.html')));
app.get('/test',          (req,res) => res.sendFile(path.join(__dirname,'public','test.html')));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n✅ ─────────────────────────────────────────');
  console.log('🚀  VaultShare is RUNNING');
  console.log('🌐  http://localhost:' + PORT + '/register');
  console.log('🌐  http://localhost:' + PORT + '/login');
  console.log('📊  http://localhost:' + PORT + '/dashboard');
  console.log('🔧  http://localhost:' + PORT + '/test  ← test here first');
  console.log('─────────────────────────────────────────\n');
});