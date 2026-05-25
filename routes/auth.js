// routes/auth.js

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db      = require('../utils/db');

const JWT_SECRET   = process.env.JWT_SECRET || 'vaultshare-secret-change-in-production';
const TOKEN_EXPIRY = '7d';

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  console.log('📝 REGISTER attempt:', req.body?.email);
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      console.log('  ✗ Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      console.log('  ✗ Password too short');
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      console.log('  ✗ Email already registered');
      return res.status(409).json({ error: 'Email already registered. Please login instead.' });
    }

    // Hash password
    console.log('  → Hashing password...');
    const hash = await bcrypt.hash(password, 10);
    const id   = uuidv4();

    // Save to DB
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, cleanEmail, hash);
    console.log('  → User saved to DB with id:', id);

    // Create JWT
    const token = jwt.sign({ id, email: cleanEmail }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    console.log('  ✓ Registration successful for:', cleanEmail);

    return res.status(200).json({ token, user: { id, email: cleanEmail } });

  } catch (err) {
    console.error('  💥 Register ERROR:', err.message, err.stack);
    return res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  console.log('🔑 LOGIN attempt:', req.body?.email);
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      console.log('  ✗ No user found for:', cleanEmail);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('  → User found, comparing password...');
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      console.log('  ✗ Wrong password for:', cleanEmail);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    console.log('  ✓ Login successful for:', cleanEmail);

    return res.status(200).json({ token, user: { id: user.id, email: user.email } });

  } catch (err) {
    console.error('  💥 Login ERROR:', err.message, err.stack);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

module.exports = router;
