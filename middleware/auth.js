// middleware/auth.js — checks the JWT token on every protected request

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'vaultshare-secret-change-in-production';

function requireAuth(req, res, next) {
  // Token must come in the Authorization header like:
  //   Authorization: Bearer eyJhbGciOi...
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  try {
    const token   = header.slice(7); // remove "Bearer "
    const payload = jwt.verify(token, JWT_SECRET);

    // Attach user info to the request so route handlers can use req.user.id
    req.user = payload; // { id, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please login again.' });
  }
}

module.exports = requireAuth;
