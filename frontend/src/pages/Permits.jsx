import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const oneYearAhead = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };

// Admin: approve, renew or suspend vehicle permits.
export default function Permits({ onExpired }) {
  const [vehicles, setVehicles] = useState([]);
  const [expiry, setExpiry] = useState(oneYearAhead());
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try { setVehicles(await api('/vehicles')); }
    catch (e) { if (e.message === 'Login required') onExpired(); else setMsg({ type: 'error', text: e.message }); }
  };
  useEffect(() => { load(); }, []);

  const set = async (v, status) => {
    setMsg(null);
    try {
      await api('/vehicles/' + v.id + '/permit', 'PATCH', { status, expiry: status === 'approved' ? expiry : v.permit_expiry });
      setMsg({ type: 'ok', text: v.plate + ' permit is now ' + status });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <section>
      <div className="head-row">
        <h2>Vehicle permits</h2>
        <label className="inline">New permits expire on
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
      </div>
      {msg && <div className={msg.type === 'ok' ? 'notice' : 'error'}>{msg.text}</div>}
      <div className="panel">
        {vehicles.length === 0 ? <p className="muted">No vehicles registered yet.</p> : (
          <div className="scroll"><table className="table">
            <thead><tr><th>Plate</th><th>Owner</th><th>Role</th><th>Permit</th><th>Expiry</th><th>Points</th><th>Action</th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td><b>{v.plate}</b></td><td>{v.owner}</td><td>{v.owner_role}</td>
                  <td><span className={'pill ' + v.permit_status}>{v.permit_status}</span></td>
                  <td>{v.permit_expiry ? v.permit_expiry.slice(0, 10) : '-'}</td>
                  <td>{v.points}</td>
                  <td className="actions">
                    {v.permit_status !== 'approved' && <button className="small ok" onClick={() => set(v, 'approved')}>{v.permit_status === 'pending' ? 'Approve' : 'Renew'}</button>}
                    {v.permit_status === 'approved' && <button className="small bad" onClick={() => set(v, 'suspended')}>Suspend</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </section>
  );
}
