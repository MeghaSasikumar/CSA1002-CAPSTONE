// MODULE 2: Visitor, Violation and Analytics
const router = require('express').Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const pool = require('../db');
const { auth } = require('../auth');

// ---- Visitor pre-booking with QR pass (unique feature) ----
router.post('/bookings', auth('visitor'), async (req, res) => {
  const { slot_id, plate, start_time, end_time } = req.body;
  const clash = await pool.query(
    `SELECT 1 FROM bookings WHERE slot_id=$1 AND status='active' AND start_time < $3 AND end_time > $2`,
    [slot_id, start_time, end_time]
  );
  if (clash.rowCount) return res.status(400).json({ error: 'Slot already booked for that time' });

  const token = crypto.randomBytes(16).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO bookings (visitor_id,slot_id,plate,start_time,end_time,qr_token)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, slot_id, plate.toUpperCase().replace(/\s/g, ''), start_time, end_time, token]
  );
  const qr = await QRCode.toDataURL(token); // base64 image for the frontend
  res.json({ booking: rows[0], qr });
});

router.get('/bookings/mine', auth('visitor'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM bookings WHERE visitor_id=$1 ORDER BY id DESC', [req.user.id]);
  res.json(rows);
});

// Security scans QR at the gate
router.get('/bookings/verify/:token', auth('security', 'admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, s.label AS slot FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE qr_token=$1`,
    [req.params.token]
  );
  const b = rows[0];
  if (!b) return res.status(404).json({ valid: false, error: 'Invalid pass' });
  const now = new Date();
  const valid = b.status === 'active' && now >= new Date(b.start_time) && now <= new Date(b.end_time);
  res.json({ valid, booking: b });
});

// ---- Violations: points + escalating fine + auto suspension (unique feature) ----
const POINTS = { wrong_zone: 2, overstay: 1, expired_permit: 3, illegal_parking: 2 };
const SUSPEND_AT = 10;
const BASE_FINE = 100;

router.post('/violations', auth('security', 'admin'), async (req, res) => {
  const { plate, type, notes } = req.body;
  if (!POINTS[type]) return res.status(400).json({ error: 'Unknown violation type' });

  const v = (await pool.query('SELECT * FROM vehicles WHERE plate=$1', [plate.toUpperCase()])).rows[0];
  if (!v) return res.status(404).json({ error: 'Vehicle not found' });

  const prev = (await pool.query('SELECT COUNT(*)::int AS c FROM violations WHERE vehicle_id=$1', [v.id])).rows[0].c;
  const points = POINTS[type];
  const fine = BASE_FINE * points * (prev + 1); // escalates with repeat offences

  await pool.query('INSERT INTO violations (vehicle_id,type,notes,points,fine) VALUES ($1,$2,$3,$4,$5)', [v.id, type, notes, points, fine]);
  const total = v.points + points;
  const suspended = total >= SUSPEND_AT;
  await pool.query(
    "UPDATE vehicles SET points=$1, permit_status=CASE WHEN $2 THEN 'suspended' ELSE permit_status END WHERE id=$3",
    [total, suspended, v.id]
  );
  res.json({ points, fine, total_points: total, permit_suspended: suspended });
});

router.get('/violations', auth('admin', 'security'), async (_, res) => {
  const { rows } = await pool.query(
    'SELECT x.*, v.plate FROM violations x JOIN vehicles v ON v.id=x.vehicle_id ORDER BY x.created_at DESC'
  );
  res.json(rows);
});

router.get('/violations/mine', auth(), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT x.*, v.plate FROM violations x JOIN vehicles v ON v.id=x.vehicle_id WHERE v.owner_id=$1 ORDER BY x.created_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

router.patch('/violations/:id/pay', auth('admin', 'security'), async (req, res) => {
  const { rows } = await pool.query('UPDATE violations SET paid=TRUE WHERE id=$1 RETURNING *', [req.params.id]);
  res.json(rows[0]);
});

// ---- Analytics (unique feature: peak hours) ----
router.get('/analytics/peak-hours', auth('admin'), async (_, res) => {
  const { rows } = await pool.query(
    `SELECT EXTRACT(HOUR FROM entry_time)::int AS hour, COUNT(*)::int AS entries
     FROM parking_logs GROUP BY hour ORDER BY hour`
  );
  res.json(rows);
});

router.get('/analytics/zone-usage', auth('admin'), async (_, res) => {
  const { rows } = await pool.query(
    `SELECT z.name AS zone, COUNT(l.id)::int AS entries
     FROM zones z LEFT JOIN slots s ON s.zone_id=z.id LEFT JOIN parking_logs l ON l.slot_id=s.id
     GROUP BY z.name ORDER BY entries DESC`
  );
  res.json(rows);
});

router.get('/analytics/violations', auth('admin'), async (_, res) => {
  const { rows } = await pool.query(
    'SELECT type, COUNT(*)::int AS count, SUM(fine)::int AS total_fine FROM violations GROUP BY type'
  );
  res.json(rows);
});

module.exports = router;
