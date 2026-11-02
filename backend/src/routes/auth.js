const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { sign } = require('../auth');

// Public signup is limited to these roles (security/admin are created by admin)
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!['student', 'staff', 'visitor'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,role',
      [name, email, hash, role]
    );
    res.json({ user: rows[0], token: sign(rows[0]) });
  } catch {
    res.status(400).json({ error: 'Email already registered' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ user: { id: u.id, name: u.name, role: u.role }, token: sign(u) });
});

module.exports = router;
