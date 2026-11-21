import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Owner view: own violation history and unpaid fines.
export default function MyViolations({ onExpired }) {
  const [list, setList] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  useEffect(() => {
    Promise.all([api('/violations/mine'), api('/vehicles/mine')])
      .then(([v, veh]) => { setList(v); setVehicles(veh); })
      .catch((e) => { if (e.message === 'Login required') onExpired(); });
  }, []);
  const unpaid = list.filter((v) => !v.paid).reduce((n, v) => n + v.fine, 0);

  return (
    <section>
      <h2>My violations</h2>
      <div className="summary">
        <div className="stat"><b>{list.length}</b><span>violations</span></div>
        <div className="stat"><b>{unpaid}</b><span>unpaid fine</span></div>
        <div className="stat"><b>{vehicles.reduce((n, v) => Math.max(n, v.points), 0)} / 10</b><span>points (permit suspends at 10)</span></div>
      </div>
      <div className="panel">
        {list.length === 0 ? <p className="muted">You have no violations. Keep it up!</p> : (
          <div className="scroll"><table className="table">
            <thead><tr><th>Plate</th><th>Type</th><th>Points</th><th>Fine</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>{list.map((v) => (
              <tr key={v.id}><td><b>{v.plate}</b></td><td>{v.type.replace('_', ' ')}</td><td>{v.points}</td><td>{v.fine}</td>
                <td>{new Date(v.created_at).toLocaleDateString()}</td>
                <td><span className={'pill ' + (v.paid ? 'approved' : 'pending')}>{v.paid ? 'paid' : 'unpaid'}</span></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </section>
  );
}
