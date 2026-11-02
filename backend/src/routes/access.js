// MODULE 1: Vehicle, Access and Slot Management
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { auth } = require('../auth');

// Admin creates security/admin accounts
router.post('/users', auth('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role',
    [name, email, hash, role]
  );
  res.json(rows[0]);
});

// ---- Vehicles and permits ----
router.post('/vehicles', auth('student', 'staff', 'visitor'), async (req, res) => {
  const { plate, type } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO vehicles (owner_id,plate,type) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, plate.toUpperCase().replace(/\s/g, ''), type || 'car']
    );
    res.json(rows[0]);
  } catch {
    res.status(400).json({ error: 'Plate already registered' });
  }
});

router.get('/vehicles/mine', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM vehicles WHERE owner_id=$1', [req.user.id]);
  res.json(rows);
});

router.get('/vehicles', auth('admin', 'security'), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT v.*, u.name AS owner, u.role AS owner_role FROM vehicles v JOIN users u ON u.id=v.owner_id ORDER BY v.id DESC'
  );
  res.json(rows);
});

// Admin approves / renews permit
router.patch('/vehicles/:id/permit', auth('admin'), async (req, res) => {
  const { status, expiry } = req.body; // approved | suspended | expired
  const { rows } = await pool.query(
    'UPDATE vehicles SET permit_status=$1, permit_expiry=$2 WHERE id=$3 RETURNING *',
    [status, expiry || null, req.params.id]
  );
  res.json(rows[0]);
});

// Security: plate lookup (owner, permit, violation history)
router.get('/vehicles/lookup/:plate', auth('admin', 'security'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.*, u.name AS owner, u.role AS owner_role,
       (SELECT json_agg(x) FROM (SELECT type,points,fine,created_at FROM violations WHERE vehicle_id=v.id ORDER BY created_at DESC) x) AS violations
     FROM vehicles v JOIN users u ON u.id=v.owner_id WHERE v.plate=$1`,
    [req.params.plate.toUpperCase()]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(rows[0]);
});

// ---- Zones and slots ----
router.get('/zones', auth(), async (_, res) => {
  const { rows } = await pool.query(
    `SELECT z.*, COUNT(s.id) AS total,
       COUNT(s.id) FILTER (WHERE s.status='free') AS free
     FROM zones z LEFT JOIN slots s ON s.zone_id=z.id GROUP BY z.id ORDER BY z.id`
  );
  res.json(rows);
});

router.get('/slots', auth(), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM slots WHERE ($1::int IS NULL OR zone_id=$1) ORDER BY id',
    [req.query.zone_id || null]
  );
  res.json(rows);
});

router.post('/zones', auth('admin'), async (req, res) => {
  const { name, allowed_roles, slot_count } = req.body;
  const z = (await pool.query('INSERT INTO zones (name,allowed_roles) VALUES ($1,$2) RETURNING *', [name, allowed_roles])).rows[0];
  await pool.query(
    "INSERT INTO slots (zone_id,label) SELECT $1, $2 || '-' || g FROM generate_series(1,$3::int) g",
    [z.id, name, slot_count || 10]
  );
  res.json(z);
});

// ---- Entry / exit (core flow, matches your Raptor flowchart) ----
router.post('/entry', auth('security', 'admin'), async (req, res) => {
  const plate = req.body.plate.toUpperCase().replace(/\s/g, '');
  const slotId = req.body.slot_id;

  const v = (await pool.query(
    'SELECT v.*, u.role AS owner_role FROM vehicles v JOIN users u ON u.id=v.owner_id WHERE plate=$1', [plate]
  )).rows[0];
  if (!v) return res.status(404).json({ error: 'Vehicle not registered' });

  // 1. Permit check
  if (v.permit_status !== 'approved') return res.status(403).json({ error: `Permit is ${v.permit_status}` });
  if (v.permit_expiry && new Date(v.permit_expiry) < new Date()) {
    await pool.query("UPDATE vehicles SET permit_status='expired' WHERE id=$1", [v.id]);
    return res.status(403).json({ error: 'Permit expired' });
  }

  // 2. Already inside?
  const open = await pool.query('SELECT 1 FROM parking_logs WHERE vehicle_id=$1 AND exit_time IS NULL', [v.id]);
  if (open.rowCount) return res.status(400).json({ error: 'Vehicle already inside' });

  // 3. Slot + role-based zone check (unique feature)
  const s = (await pool.query(
    'SELECT s.*, z.allowed_roles, z.name AS zone FROM slots s JOIN zones z ON z.id=s.zone_id WHERE s.id=$1', [slotId]
  )).rows[0];
  if (!s) return res.status(404).json({ error: 'Slot not found' });
  if (!s.allowed_roles.includes(v.owner_role))
    return res.status(403).json({ error: `${v.owner_role} not allowed in ${s.zone}` });
  if (s.status === 'occupied') return res.status(400).json({ error: 'Slot occupied' });

  // 4. Visitors need an active booking for this slot
  if (v.owner_role === 'visitor') {
    const b = await pool.query(
      "SELECT id FROM bookings WHERE plate=$1 AND slot_id=$2 AND status='active' AND NOW() BETWEEN start_time AND end_time",
      [plate, slotId]
    );
    if (!b.rowCount) return res.status(403).json({ error: 'No valid booking for this slot' });
    await pool.query("UPDATE bookings SET status='used' WHERE id=$1", [b.rows[0].id]);
  }

  await pool.query("UPDATE slots SET status='occupied' WHERE id=$1", [slotId]);
  const log = (await pool.query('INSERT INTO parking_logs (vehicle_id,slot_id) VALUES ($1,$2) RETURNING *', [v.id, slotId])).rows[0];
  res.json({ message: 'Entry allowed', log });
});

router.post('/exit', auth('security', 'admin'), async (req, res) => {
  const plate = req.body.plate.toUpperCase().replace(/\s/g, '');
  const { rows } = await pool.query(
    `UPDATE parking_logs SET exit_time=NOW()
     WHERE exit_time IS NULL AND vehicle_id=(SELECT id FROM vehicles WHERE plate=$1) RETURNING *`, [plate]
  );
  if (!rows[0]) return res.status(404).json({ error: 'No active parking record' });
  await pool.query("UPDATE slots SET status='free' WHERE id=$1", [rows[0].slot_id]);
  res.json({ message: 'Exit recorded', log: rows[0] });
});

// ---- Find my vehicle (unique feature) ----
router.get('/find-my-vehicle', auth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.plate, s.label AS slot, z.name AS zone, l.entry_time
     FROM parking_logs l JOIN vehicles v ON v.id=l.vehicle_id
     JOIN slots s ON s.id=l.slot_id JOIN zones z ON z.id=s.zone_id
     WHERE v.owner_id=$1 AND l.exit_time IS NULL`, [req.user.id]
  );
  res.json(rows);
});

module.exports = router;
