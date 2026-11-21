import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Security gate: look up a plate, let a vehicle in (choose slot) or record its exit.
export default function Gate({ onExpired }) {
  const [plate, setPlate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState(null);
  const [token, setToken] = useState('');
  const [pass, setPass] = useState(null);

  const loadSlots = async () => {
    try { setSlots(await api('/slots')); } catch (e) { if (e.message === 'Login required') onExpired(); }
  };
  useEffect(() => { loadSlots(); const t = setInterval(loadSlots, 5000); return () => clearInterval(t); }, []);

  const clean = () => plate.toUpperCase().replace(/\s/g, '');
  const run = async (fn) => {
    setMsg(null);
    try { await fn(); } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const lookup = () => run(async () => {
    setInfo(await api('/vehicles/lookup/' + clean()));
  });
  const entry = () => run(async () => {
    if (!slotId) throw new Error('Choose a slot first');
    const r = await api('/entry', 'POST', { plate: clean(), slot_id: Number(slotId) });
    setMsg({ type: 'ok', text: r.message + ' for ' + clean() });
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
        <label className="field">Slot (free slots only)
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
            <option value="">Choose a slot...</option>
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
