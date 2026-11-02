const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev-secret';

const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name }, SECRET, { expiresIn: '1d' });

// Usage: auth() = any logged-in user, auth('admin','security') = only these roles
const auth = (...roles) => (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Login required' });
  }
  if (roles.length && !roles.includes(req.user.role))
    return res.status(403).json({ error: 'Access denied for your role' });
  next();
};
module.exports = { sign, auth };
