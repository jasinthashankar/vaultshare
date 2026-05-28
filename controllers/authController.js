const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || 'vaultshare-jwt-secret-2024';

const registerUser = async (req, res) => {
  try {
    const username = (req.body.username || req.body.email || '').toLowerCase().trim();
    const { password } = req.body;
    console.log('\n[REGISTER] username:', username);

    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', username)
      .single();

    if (existing)
      return res.status(409).json({ error: 'This username is already registered. Please login.' });

    const hash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert([{ email: username, hash }])
      .select()
      .single();

    if (error) throw error;

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
    console.log('[REGISTER] success for', user.email);
    res.json({ token, user: { id: user.id, email: user.email } });

  } catch (err) {
    console.error('[REGISTER] ERROR:', err);
    res.status(500).json({ error: 'Registration error: ' + err.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const username = (req.body.username || req.body.email || '').toLowerCase().trim();
    const { password } = req.body;
    console.log('\n[LOGIN] username:', username);

    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', username)
      .single();

    if (!user)
      return res.status(401).json({ error: 'No account found. Please register first.' });

    const valid = await bcrypt.compare(password, user.hash);
    if (!valid)
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
    console.log('[LOGIN] success for', user.email);
    res.json({ token, user: { id: user.id, email: user.email } });

  } catch (err) {
    console.error('[LOGIN] ERROR:', err);
    res.status(500).json({ error: 'Login error: ' + err.message });
  }
};

module.exports = { registerUser, loginUser };
