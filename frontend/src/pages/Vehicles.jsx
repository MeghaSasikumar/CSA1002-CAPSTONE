import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Owner view: register a vehicle, see permit status, and "Find my vehicle".
export default function Vehicles({ onExpired }) {
  const [vehicles, setVehicles] = useState([]);
  const [parked, setParked] = useState([]);
  const [plate, setPlate] = useState('');
  const [type, setType] = useState('car');
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const [v, p] = await Promise.all([api('/vehicles/mine'), api('/find-my-vehicle')]);
      setVehicles(v); setParked(p);
    } catch (e) {
      if (e.message === 'Login required') onExpired(); else setMsg({ type: 'error', text: e.message });
    }
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const add = async (e) => {
    e.preventDefault(); setMsg(null);
    try {
      await api('/vehicles', 'POST', { plate, type });
      setPlate('');
      setMsg({ type: 'ok', text: 'Vehicle registered. Wait for the admin to approve your permit.' });
      load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  return (
    <section>
      <h2>My vehicles</h2>

      <div className="panel">
        <h3>Find my vehicle</h3>
        {parked.length === 0 && <p className="muted">None of your vehicles is parked on campus right now.</p>}
        {parked.map((p) => (
          <div key={p.plate} className="found">
            <b>{p.plate}</b> is parked in <b>{p.zone}</b>, slot <b>{p.slot.split('-').pop()}</b>
            <span className="muted"> &middot; since {new Date(p.entry_time).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Register a vehicle</h3>
        <form className="row" onSubmit={add}>
          <input placeholder="Number plate, e.g. TN01AB1234" value={plate} onChange={(e) => setPlate(e.target.value)} required />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="car">Car</option>
            <option value="bike">Bike</option>
          </select>
          <button className="primary">Register</button>
        </form>
        {msg && <div className={msg.type === 'ok' ? 'notice' : 'error'}>{msg.text}</div>}
      </div>

      <div className="panel">
        <h3>Registered vehicles</h3>
        {vehicles.length === 0 ? <p className="muted">No vehicles yet.</p> : (
          <div className="scroll"><table className="table">
            <thead><tr><th>Plate</th><th>Type</th><th>Permit</th><th>Expiry</th><th>Violation points</th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td><b>{v.plate}</b></td><td>{v.type}</td>
                  <td><span className={'pill ' + v.permit_status}>{v.permit_status}</span></td>
                  <td>{v.permit_expiry ? v.permit_expiry.slice(0, 10) : '-'}</td>
                  <td>{v.points}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </section>
  );
}
