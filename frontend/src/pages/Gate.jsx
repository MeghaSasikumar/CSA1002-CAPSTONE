import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Security gate: look up a plate, verify visitor QR passes, let a vehicle in or record its exit.
// Slots are assigned automatically: the first free slot in the owner's zone.
export default function Gate({ onExpired }) {
  const [plate, setPlate] = useState('');
  const [zones, setZones] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState(null);
  const [token, setToken] = useState('');
  const [pass, setPass] = useState(null);

  const loadSlots = async () => {
    try {
      const [z, s] = await Promise.all([api('/zones'), api('/slots')]);
      setZones(z); setSlots(s);
      return { zones: z, slots: s };
    } catch (e) {
      if (e.message === 'Login required') onExpired();
      return { zones, slots };
    }
  };
  useEffect(() => { loadSlots(); const t = setInterval(loadSlots, 5000); return () => clearInterval(t); }, []);

  const clean = () => plate.toUpperCase().replace(/\s/g, '');
  const run = async (fn) => {
    setMsg(null);
    try { await fn(); } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  // First free slot (lowest id) in the zone that allows this owner's role.
  const autoSlot = (role, data) => {
    const zone = data.zones.find((z) => z.allowed_roles.includes(role));
    if (!zone) return null;
    return data.slots.filter((s) => s.zone_id === zone.id && s.status === 'free').sort((a, b) => a.id - b.id)[0] || null;
  };

  const lookup = () => run(async () => {
    const v = await api('/vehicles/lookup/' + clean());
    setInfo(v);
    if (v.owner_role === 'visitor') {
      setSlotId('');
      setMsg({ type: 'ok', text: 'Visitor vehicle: verify the visitor QR pass above to fill in the booked slot.' });
      return;
    }
    const data = await loadSlots();
    const s = autoSlot(v.owner_role, data);
    if (s) {
      setSlotId(String(s.id));
      setMsg({ type: 'ok', text: 'Slot assigned automatically: ' + s.label + '. Click Allow entry to confirm.' });
    } else {
      setSlotId('');
      setMsg({ type: 'error', text: 'No free slot left in the ' + v.owner_role + ' zone.' });
    }
  });

  const entry = () => run(async () => {
    let chosen = slotId;
    // If the guard skipped Look up, assign the slot now.
    if (!chosen) {
      const v = await api('/vehicles/lookup/' + clean());
      setInfo(v);
      if (v.owner_role === 'visitor') throw new Error('Visitor: verify the QR pass first so the booked slot is filled in.');
      const s = autoSlot(v.owner_role, await loadSlots());
      if (!s) throw new Error('No free slot left in the ' + v.owner_role + ' zone.');
      chosen = String(s.id);
    }
    const r = await api('/entry', 'POST', { plate: clean(), slot_id: Number(chosen) });
    const label = (slots.find((s) => String(s.id) === chosen) || {}).label || 'slot ' + chosen;
    setMsg({ type: 'ok', text: r.message + ': ' + clean() + ' assigned to ' + label });
    setSlotId(''); loadSlots();
    try { setInfo(await api('/vehicles/lookup/' + clean())); } catch { /* ignore */ }
  });

  const exit = () => run(async () => {
    const r = await api('/exit', 'POST', { plate: clean() });
    setMsg({ type: 'ok', text: r.message + ' for ' + clean() });
    loadSlots();
  });

  const verify = () => run(async () => {
    const r = await api('/bookings/verify/' + token.trim());
    setPass(r);
    if (r.valid) { setPlate(r.booking.plate); setSlotId(String(r.booking.slot_id)); }
  });

  const free = slots.filter((s) => s.status === 'free');

  return (
    <section>
      <h2>Security gate</h2>
      <div className="panel">
        <h3>Verify visitor QR pass</h3>
        <div className="row">
          <input placeholder="Scan or paste the pass code" value={token} onChange={(e) => setToken(e.target.value)} />
          <button className="ghost dark" disabled={!token} onClick={verify}>Verify pass</button>
        </div>
        {pass && (
          <div className={pass.valid ? 'notice' : 'error'}>
            {pass.valid
              ? <>Valid pass for <b>{pass.booking.plate}</b>, slot <b>{pass.booking.slot}</b>. Plate and slot are filled in below: click <b>Allow entry</b>.</>
              : <>Pass is not valid{pass.booking && pass.booking.status !== 'active' ? ' (' + pass.booking.status + ')' : ' (outside its time window)'}.</>}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Vehicle entry and exit</h3>
        <label className="field">Number plate
          <input placeholder="e.g. TN01AB1234" value={plate} onChange={(e) => setPlate(e.target.value)} />
        </label>
        <label className="field">Slot (filled automatically after Look up, you can change it)
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
            <option value="">Auto-assign from the owner's zone</option>
            {free.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <div className="row">
          <button className="ghost dark" disabled={!plate} onClick={lookup}>Look up</button>
          <button className="primary" disabled={!plate} onClick={entry}>Allow entry</button>
          <button className="ghost dark" disabled={!plate} onClick={exit}>Record exit</button>
        </div>
        {msg && <div className={msg.type === 'ok' ? 'notice' : 'error'}>{msg.text}</div>}
      </div>

      {info && (
        <div className="panel">
          <h3>{info.plate}</h3>
          <div className="facts">
            <div><span>Owner</span><b>{info.owner} ({info.owner_role})</b></div>
            <div><span>Permit</span><b><span className={'pill ' + info.permit_status}>{info.permit_status}</span></b></div>
            <div><span>Expiry</span><b>{info.permit_expiry ? info.permit_expiry.slice(0, 10) : '-'}</b></div>
            <div><span>Violation points</span><b>{info.points}</b></div>
          </div>
          <h4>Violation history</h4>
          {info.violations && info.violations.length ? (
            <table className="table"><thead><tr><th>Type</th><th>Points</th><th>Fine</th><th>Date</th></tr></thead>
              <tbody>{info.violations.map((v, i) => (
                <tr key={i}><td>{v.type.replace('_', ' ')}</td><td>{v.points}</td><td>{v.fine}</td><td>{new Date(v.created_at).toLocaleDateString()}</td></tr>
              ))}</tbody></table>
          ) : <p className="muted">No violations on record.</p>}
        </div>
      )}
    </section>
  );
}
