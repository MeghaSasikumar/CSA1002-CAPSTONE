const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/access'));     // Module 1
app.use('/api', require('./routes/visitors'));   // Module 2
app.get('/api/health', (_, res) => res.json({ ok: true }));

async function seedAdmin() {
  const { rowCount } = await pool.query("SELECT 1 FROM users WHERE role='admin'");
  if (!rowCount) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      "INSERT INTO users (name,email,password_hash,role) VALUES ('Admin','admin@parksmart.local',$1,'admin')",
      [hash]
    );
    console.log('Seeded admin: admin@parksmart.local / admin123');
  }
}

seedAdmin().then(() =>
  app.listen(process.env.PORT || 5000, () => console.log('ParkSmart API running'))
);
