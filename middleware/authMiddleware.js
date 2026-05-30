const supabase = require('../config/supabaseClient');

async function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Login required' });
  const token = h.slice(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid token');
    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired, please login again' });
  }
}

module.exports = { requireAuth };
