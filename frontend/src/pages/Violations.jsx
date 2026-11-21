import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPES = [
  ['wrong_zone', 'Wrong zone (2 points)'], ['overstay', 'Overstay (1 point)'],
  ['expired_permit', 'Expired permit (3 points)'], ['illegal_parking', 'Illegal parking (2 points)'],
];

// Security/admin: log a violation (points + escalating fine) and review the history.
export default function Violations({ onExpired }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ plate: '', type: 'wrong_zone', notes: '' });
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = async () => {
    try { setList(await api('/violations')); } catch (e) { if (e.message === 'Login required') onExpired(); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setMsg(null); setResult(null);
    try {
      const r = await api('/violations', 'POST', { ...form, plate: form.plate.toUpperCase().replace(/\s/g, '') });
      setResult(r); setForm({ ...form, notes: '' }); load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };
  const pay = async (id) => { try { await api('/violations/' + id + '/pay', 'PATCH'); load(); } catch (e) { setMsg({ type: 'error', text: e.message }); } };

  return (
    <section>
      <h2>Violations</h2>
      <div className="panel">
        <h3>Log a violation</h3>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field">Number plate<input value={form.plate} onChange={set('plate')} placeholder="TN01AB1234" required /></label>
            <label className="field">Type
              <select value={form.type} onChange={set('type')}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="field wide">Notes<input value={form.notes} onChange={set('notes')} placeholder="Optional details" /></label>
          </div>
          <button className="primary">Record violation</button>
        </form>
        {msg && <div className="error">{msg.text}</div>}
        {result && (
          <div className={result.permit_suspended ? 'error' : 'notice'}>
            +{result.points} points, fine <b>{result.fine}</b>. Total points: <b>{result.total_points}</b> of 10.
            {result.permit_suspended && <b> Permit suspended automatically.</b>}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>All violations</h3>
        {list.length === 0 ? <p className="muted">No violations recorded.</p> : (
          <div className="scroll"><table className="table">
            <thead><tr><th>Plate</th><th>Type</th><th>Points</th><th>Fine</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((v) => (
              <tr key={v.id}>
                <td><b>{v.plate}</b></td><td>{v.type.replace('_', ' ')}</td><td>{v.points}</td><td>{v.fine}</td>
                <td>{new Date(v.created_at).toLocaleDateString()}</td>
                <td><span className={'pill ' + (v.paid ? 'approved' : 'pending')}>{v.paid ? 'paid' : 'unpaid'}</span></td>
                <td>{!v.paid && <button className="small ok" onClick={() => pay(v.id)}>Mark paid</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </section>
  );
}
