// ============================================================
//  VaultShare — Modular Server (Cloudinary + Supabase)
// ============================================================
require('dotenv').config();

const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const cors     = require('cors');
const morgan   = require('morgan');

// Load Routes
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const supabase = require('./config/supabaseClient');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'vs-session', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/analytics', analyticsRoutes);

// Maintain old route compatibility for access.js if needed
const { getFileInfo, downloadFile } = require('./controllers/fileController');
app.get('/f/info/:token', getFileInfo);
app.post('/f/download/:token', downloadFile);

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const { count: users } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: files } = await supabase.from('files').select('*', { count: 'exact', head: true });
    res.json({ status: 'ok', users, files, time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HTML Page Routes ─────────────────────────────────────────
app.get('/',              (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/dashboard',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/retrieve',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'retrieve.html')));
app.get('/access/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'access.html')));
app.get('/test',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'test.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')));
app.get('/reset-password',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n✅ ─────────────────────────────────────────');
  console.log('🚀  VaultShare is RUNNING (Modular Structure)');
  console.log('☁️   Files    → Cloudinary');
  console.log('🗄️   Database → Supabase');
  console.log('🌐  http://localhost:' + PORT + '/login');
  console.log('📊  http://localhost:' + PORT + '/dashboard');
  console.log('─────────────────────────────────────────\n');
});