const supabase = require('../config/supabaseClient');
require('dotenv').config();

const registerUser = async (req, res) => {
  try {
    const email = (req.body.username || req.body.email || '').toLowerCase().trim();
    const { password } = req.body;
    console.log('\n[REGISTER] email:', email);

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Supabase Auth SignUp
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    const user = data.user;
    if (!user) return res.status(400).json({ error: 'Registration failed, no user returned.' });

    // Sync to public.users to maintain database relationships
    const { error: syncError } = await supabase
      .from('users')
      .upsert([{ id: user.id, email: user.email, hash: 'supabase_auth' }]);
    
    if (syncError) console.error('[SYNC ERROR]', syncError);

    const token = data.session ? data.session.access_token : null;
    res.json({ token, user: { id: user.id, email: user.email } });

  } catch (err) {
    console.error('[REGISTER] ERROR:', err);
    res.status(500).json({ error: 'Registration error: ' + err.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const email = (req.body.username || req.body.email || '').toLowerCase().trim();
    const { password } = req.body;
    console.log('\n[LOGIN] email:', email);

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    res.json({ 
      token: data.session.access_token, 
      user: { id: data.user.id, email: data.user.email } 
    });

  } catch (err) {
    console.error('[LOGIN] ERROR:', err);
    res.status(500).json({ error: 'Login error: ' + err.message });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${req.protocol}://${req.get('host')}/reset-password`,
    });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, message: 'Password reset email sent' });

  } catch (err) {
    console.error('[RESET_REQ] ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1]; // The user must pass the recovery token

    if (!newPassword) return res.status(400).json({ error: 'New password is required' });
    if (!token) return res.status(401).json({ error: 'Recovery token missing' });

    // Supabase handles password updates for the authenticated user
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ success: true, message: 'Password successfully updated' });

  } catch (err) {
    console.error('[UPDATE_PW] ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  requestPasswordReset,
  updatePassword
};
