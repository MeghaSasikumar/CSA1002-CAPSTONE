CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','staff','visitor','security','admin'))
);
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES users(id),
  plate TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'car',
  permit_status TEXT DEFAULT 'pending' CHECK (permit_status IN ('pending','approved','suspended','expired')),
  permit_expiry DATE,
  points INT DEFAULT 0
);
CREATE TABLE zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  allowed_roles TEXT[] NOT NULL
);
CREATE TABLE slots (
  id SERIAL PRIMARY KEY,
  zone_id INT REFERENCES zones(id),
  label TEXT NOT NULL,
  status TEXT DEFAULT 'free' CHECK (status IN ('free','occupied','reserved'))
);
CREATE TABLE parking_logs (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id),
  slot_id INT REFERENCES slots(id),
  entry_time TIMESTAMP DEFAULT NOW(),
  exit_time TIMESTAMP
);
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  visitor_id INT REFERENCES users(id),
  slot_id INT REFERENCES slots(id),
  plate TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  qr_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','used','cancelled'))
);
CREATE TABLE violations (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id),
  type TEXT NOT NULL,
  notes TEXT,
  points INT NOT NULL,
  fine INT NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO zones (name, allowed_roles) VALUES
  ('Student Zone', '{student}'),
  ('Staff Zone', '{staff}'),
  ('Visitor Zone', '{visitor}');
INSERT INTO slots (zone_id, label)
  SELECT z.id, z.name || '-' || g FROM zones z, generate_series(1,10) g;
