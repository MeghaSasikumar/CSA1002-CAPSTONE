import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';

const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const fmt = (d) => new Date(d).toLocaleString();

// Visitor: pre-book a Visitor Zone slot and get a QR pass for the gate.
export default function Bookings({ onExpired }) {
  const [vehicles, setVehicles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ plate: '', slot_id: '', start: toLocalInput(new Date()), end: toLocalInput(new Date(Date.now() + 2 * 3600 * 1000)) });
  const [pass, setPass] = useState(null);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = async () => {
    try {
      const [v, s, z, b] = await Promise.all([api('/vehicles/mine'), api('/slots'), api('/zones'), api('/bookings/mine')]);
      const vz = z.find((x) => x.allowed_roles.includes('visitor'));
      setVehicles(v.filter((x) => x.permit_status === 'approved'));
      setSlots(s.filter((x) => vz && x.zone_id === vz.id));
      setBookings(b);
    } catch (e) { if (e.message === 'Login required') onExpired(); else setMsg({ type: 'error', text: e.message }); }
  };
  useEffect(() => { load(); }, []);

  const slotLabel = (id) => (slots.find((s) => s.id === id) || {}).label || 'Slot ' + id;
  const showPass = async (b) => {
    const img = await QRCode.toDataURL(b.qr_token, { width: 260, margin: 1 });
    setPass({ img, plate: b.plate, slot: slotLabel(b.slot_id), start: b.start_time, end: b.end_time, token: b.qr_token });
  };

  const book = async (e) => {
    e.preventDefault(); setMsg(null);
    try {
      const r = await api('/bookings', 'POST', {
        slot_id: Number(form.slot_id), plate: form.plate,
        start_time: new Date(form.start).toISOString(), end_time: new Date(form.end).toISOString(),
      });
      await showPass(r.booking);
      setMsg({ type: 'ok', text: 'Booking confirmed. Show the QR pass at the gate.' });
      load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  return (
    <section>
      <h2>Book a visitor slot</h2>
      <div className="panel">
        {vehicles.length === 0 ? (
          <p className="muted">You need an <b>approved</b> vehicle first. Register one in <b>My Vehicles</b> and ask the admin to approve the permit.</p>
        ) : (
          <form onSubmit={book}>
            <div className="form-grid">
              <label className="field">Vehicle
                <select value={form.plate} onChange={set('plate')} required>
                  <option value="">Choose...</option>
                  {vehicles.map((v) => <option key={v.id} value={v.plate}>{v.plate}</option>)}
                </select>
              </label>
              <label className="field">Visitor slot
                <select value={form.slot_id} onChange={set('slot_id')} required>
                  <option value="">Choose...</option>
                  {slots.filter((s) => s.status === 'free').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <label className="field">From<input type="datetime-local" value={form.start} onChange={set('start')} required /></label>
              <label className="field">Until<input type="datetime-local" value={form.end} onChange={set('end')} required /></label>
            </div>
            <button className="primary">Book and get QR pass</button>
          </form>
        )}
        {msg && <div className={msg.type === 'ok' ? 'notice' : 'error'}>{msg.text}</div>}
      </div>

      {pass && (
        <div className="panel pass">
          <img src={pass.img} alt="QR pass" width="220" height="220" />
          <div>
            <h3>Visitor QR pass</h3>
            <p><b>{pass.plate}</b> &middot; {pass.slot}</p>
            <p className="muted">{fmt(pass.start)} to {fmt(pass.end)}</p>
            <p className="muted small-text">Pass code (for the gate): <code>{pass.token}</code></p>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>My bookings</h3>
        {bookings.length === 0 ? <p className="muted">No bookings yet.</p> : (
          <div className="scroll"><table className="table">
            <thead><tr><th>Plate</th><th>Slot</th><th>From</th><th>Until</th><th>Status</th><th></th></tr></thead>
            <tbody>{bookings.map((b) => (
              <tr key={b.id}>
                <td><b>{b.plate}</b></td><td>{slotLabel(b.slot_id)}</td><td>{fmt(b.start_time)}</td><td>{fmt(b.end_time)}</td>
                <td><span className={'pill ' + (b.status === 'active' ? 'approved' : 'expired')}>{b.status}</span></td>
                <td><button className="small ok" onClick={() => showPass(b)}>Show QR</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </section>
  );
}
