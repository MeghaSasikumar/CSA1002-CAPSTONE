// ParkSmart smoke test: runs visitor QR booking flow + analytics in one go.
// Run inside the backend container (see instructions): node smoke-test.js
const B = 'http://localhost:5000/api';
let passed = 0, failed = 0;

async function call(method, path, token, body) {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const show = (v) => JSON.stringify(v).slice(0, 160);
function check(name, ok, r) {
  if (ok) passed++; else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + r.status + ' ' + show(r.data)}`);
}

(async () => {
  // --- Admin ---
  let r = await call('POST', '/auth/login', null, { email: 'admin@parksmart.local', password: 'admin123' });
  check('Admin login', r.status === 200, r);
  const admin = r.data.token;

  // --- Security guard (create if missing) ---
  r = await call('POST', '/auth/login', null, { email: 'guard@parksmart.local', password: 'guard123' });
  if (r.status !== 200) {
    await call('POST', '/users', admin, { name: 'Guard Ravi', email: 'guard@parksmart.local', password: 'guard123', role: 'security' });
    r = await call('POST', '/auth/login', null, { email: 'guard@parksmart.local', password: 'guard123' });
  }
  check('Security login', r.status === 200, r);
  const guard = r.data.token;

  // --- Visitor (register or login) ---
  const visitorBody = { name: 'Ravi Visitor', email: 'visitor@test.com', password: 'pass123', role: 'visitor' };
  r = await call('POST', '/auth/register', null, visitorBody);
  if (r.status !== 200) r = await call('POST', '/auth/login', null, { email: visitorBody.email, password: visitorBody.password });
  check('Visitor ready', r.status === 200, r);
  const visitor = r.data.token;

  // --- Visitor vehicle (register or find existing) ---
  const plate = 'MH12XY9999';
  r = await call('POST', '/vehicles', visitor, { plate, type: 'car' });
  let vehicleId = r.data.id;
  if (r.status !== 200) {
    const mine = await call('GET', '/vehicles/mine', visitor);
    const v = (mine.data || []).find((x) => x.plate === plate);
    vehicleId = v && v.id;
    r = { status: v ? 200 : 400, data: mine.data };
  }
  check('Visitor vehicle registered', r.status === 200 && vehicleId, r);

  // --- Admin approves permit ---
  r = await call('PATCH', `/vehicles/${vehicleId}/permit`, admin, { status: 'approved', expiry: '2027-12-31' });
  check('Admin approved permit', r.status === 200 && r.data.permit_status === 'approved', r);

  // Make sure vehicle is outside before testing
  await call('POST', '/exit', guard, { plate });

  // --- Entry without booking should be blocked ---
  r = await call('POST', '/entry', guard, { plate, slot_id: 30 });
  const blocked = r.status === 403;
  check('Entry WITHOUT booking is blocked', blocked, r);
  if (!blocked) await call('POST', '/exit', guard, { plate });

  // --- Book a free visitor slot (tries 21..30), window around current time ---
  const now = Date.now();
  const start = new Date(now - 60 * 60 * 1000).toISOString();
  const end = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  let slot = null, booking = null;
  for (let s = 21; s <= 30 && !booking; s++) {
    r = await call('POST', '/bookings', visitor, { slot_id: s, plate, start_time: start, end_time: end });
    if (r.status === 200) { slot = s; booking = r.data; }
  }
  check(`Visitor booked slot ${slot} and received QR (${booking ? booking.qr.length : 0} chars)`, !!booking, r);
  if (!booking) return finish();

  // --- Verify QR pass BEFORE entry ---
  r = await call('GET', `/bookings/verify/${booking.booking.qr_token}`, guard);
  check('Security verified QR pass (valid: true)', r.status === 200 && r.data.valid === true, r);

  // --- Entry with booking ---
  r = await call('POST', '/entry', guard, { plate, slot_id: slot });
  check('Entry WITH booking allowed', r.status === 200, r);

  // --- Find my vehicle ---
  r = await call('GET', '/find-my-vehicle', visitor);
  check('Find my vehicle shows parked slot', r.status === 200 && r.data.length > 0, r);
  if (r.data[0]) console.log('      ->', show(r.data[0]));

  // --- Exit ---
  r = await call('POST', '/exit', guard, { plate });
  check('Exit recorded', r.status === 200, r);

  // --- Analytics ---
  for (const p of ['peak-hours', 'zone-usage', 'violations']) {
    r = await call('GET', '/analytics/' + p, admin);
    check(`Analytics ${p}`, r.status === 200, r);
    console.log('      ->', show(r.data));
  }
  finish();
})().catch((e) => { console.error('Script error:', e.message); process.exit(1); });

function finish() {
  console.log(`\nDone: ${passed} passed, ${failed} failed.`);
}
