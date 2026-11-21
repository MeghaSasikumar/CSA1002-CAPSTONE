import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function Bars({ rows, label, value }) {
  const max = Math.max(1, ...rows.map((r) => r[value]));
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label">{label(r)}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: (r[value] / max) * 100 + '%' }} /></div>
          <b>{r[value]}</b>
        </div>
      ))}
    </div>
  );
}

// Admin analytics: peak hours, zone usage, violation trends.
export default function Analytics({ onExpired }) {
  const [hours, setHours] = useState([]);
  const [zones, setZones] = useState([]);
  const [viol, setViol] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/analytics/peak-hours'), api('/analytics/zone-usage'), api('/analytics/violations')])
      .then(([h, z, v]) => { setHours(h); setZones(z); setViol(v); })
      .catch((e) => { if (e.message === 'Login required') onExpired(); else setError(e.message); });
  }, []);

  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, entries: (hours.find((x) => x.hour === h) || {}).entries || 0 }));
  const max = Math.max(1, ...byHour.map((x) => x.entries));
  const busiest = hours.length ? hours.reduce((a, b) => (b.entries > a.entries ? b : a)) : null;
  const totalFine = viol.reduce((n, v) => n + (v.total_fine || 0), 0);

  return (
    <section>
      <h2>Analytics</h2>
      {error && <div className="error">{error}</div>}
      <div className="summary">
        <div className="stat"><b>{hours.reduce((n, h) => n + h.entries, 0)}</b><span>total entries</span></div>
        <div className="stat"><b>{busiest ? busiest.hour + ':00' : '-'}</b><span>busiest hour</span></div>
        <div className="stat"><b>{totalFine}</b><span>total fines issued</span></div>
      </div>

      <div className="panel">
        <h3>Peak hours (entries per hour of day)</h3>
        {hours.length === 0 ? <p className="muted">No entries recorded yet.</p> : (
          <div className="cols">
            {byHour.map((x) => (
              <div className="col" key={x.hour} title={x.entries + ' entries at ' + x.hour + ':00'}>
                <span className="col-val">{x.entries || ''}</span>
                <div className={x.entries === max ? 'col-bar peak' : 'col-bar'} style={{ height: (x.entries / max) * 100 + '%' }} />
                <span className="col-label">{x.hour}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="two">
        <div className="panel">
          <h3>Zone usage (entries)</h3>
          {zones.length ? <Bars rows={zones} label={(r) => r.zone} value="entries" /> : <p className="muted">No data yet.</p>}
        </div>
        <div className="panel">
          <h3>Violations by type</h3>
          {viol.length ? <Bars rows={viol} label={(r) => r.type.replace('_', ' ')} value="count" /> : <p className="muted">No violations yet.</p>}
        </div>
      </div>
    </section>
  );
}
