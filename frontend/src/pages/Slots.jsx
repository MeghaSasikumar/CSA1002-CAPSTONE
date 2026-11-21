import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Live slot status. Refreshes every 5 seconds (near real-time, based on entry/exit logs).
export default function Slots({ user, onExpired }) {
  const [zones, setZones] = useState([]);
  const [slots, setSlots] = useState([]);
  const [updated, setUpdated] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [z, s] = await Promise.all([api('/zones'), api('/slots')]);
        if (!alive) return;
        setZones(z); setSlots(s); setUpdated(new Date()); setError('');
      } catch (err) {
        if (!alive) return;
        setError(err.message);
        if (err.message === 'Login required') onExpired();
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const totalFree = zones.reduce((n, z) => n + Number(z.free), 0);
  const total = zones.reduce((n, z) => n + Number(z.total), 0);

  return (
    <section>
      <div className="head-row">
        <h2>Live parking slots</h2>
        <div className="muted">
          {updated ? 'Updated ' + updated.toLocaleTimeString() + ' (auto-refresh every 5s)' : 'Loading...'}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="summary">
        <div className="stat"><b>{totalFree}</b><span>free slots</span></div>
        <div className="stat"><b>{total - totalFree}</b><span>occupied or reserved</span></div>
        <div className="stat"><b>{total}</b><span>total slots</span></div>
      </div>

      <div className="legend">
        <span><i className="dot free" /> Free</span>
        <span><i className="dot occupied" /> Occupied</span>
        <span><i className="dot reserved" /> Reserved</span>
      </div>

      {zones.map((z) => {
        const mine = z.allowed_roles.includes(user.role);
        return (
          <div key={z.id} className={mine ? 'zone mine' : 'zone'}>
            <div className="zone-head">
              <h3>{z.name} {mine && <em className="badge">Your zone</em>}</h3>
              <span className="muted">{z.free} of {z.total} free &middot; allowed: {z.allowed_roles.join(', ')}</span>
            </div>
            <div className="grid">
              {slots.filter((s) => s.zone_id === z.id).map((s) => (
                <div key={s.id} className={'slot ' + s.status} title={s.label + ' (' + s.status + ')'}>
                  <b>{s.label.split('-').pop()}</b>
                  <small>{s.status}</small>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
