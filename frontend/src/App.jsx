import React, { useState } from 'react';
import { getUser, clearSession } from './api.js';
import Login from './pages/Login.jsx';
import Slots from './pages/Slots.jsx';
import Vehicles from './pages/Vehicles.jsx';
import Gate from './pages/Gate.jsx';
import Permits from './pages/Permits.jsx';
import Bookings from './pages/Bookings.jsx';
import Violations from './pages/Violations.jsx';
import MyViolations from './pages/MyViolations.jsx';
import Analytics from './pages/Analytics.jsx';

const SLOTS = ['slots', 'Parking Slots'];
const VEHICLES = ['vehicles', 'My Vehicles'];
const BOOKINGS = ['bookings', 'Book a Slot'];
const MYVIOL = ['myviol', 'My Violations'];
const GATE = ['gate', 'Security Gate'];
const PERMITS = ['permits', 'Permits'];
const VIOL = ['violations', 'Violations'];
const ANALYTICS = ['analytics', 'Analytics'];

const TABS = {
  student: [SLOTS, VEHICLES, MYVIOL],
  staff: [SLOTS, VEHICLES, MYVIOL],
  visitor: [SLOTS, VEHICLES, BOOKINGS, MYVIOL],
  security: [SLOTS, GATE, VIOL],
  admin: [SLOTS, GATE, PERMITS, VIOL, ANALYTICS],
};

export default function App() {
  const [user, setUser] = useState(getUser());
  const [tab, setTab] = useState('slots');

  if (!user) return <Login onLogin={(u) => { setTab('slots'); setUser(u); }} />;

  const logout = () => { clearSession(); setUser(null); };
  const tabs = TABS[user.role] || [SLOTS];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">P</span> ParkSmart</div>
        <nav>
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <div className="who">
          <span>{user.name} <em className="role">{user.role}</em></span>
          <button className="ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="content">
        {tab === 'slots' && <Slots user={user} onExpired={logout} />}
        {tab === 'vehicles' && <Vehicles onExpired={logout} />}
        {tab === 'bookings' && <Bookings onExpired={logout} />}
        {tab === 'myviol' && <MyViolations onExpired={logout} />}
        {tab === 'gate' && <Gate onExpired={logout} />}
        {tab === 'permits' && <Permits onExpired={logout} />}
        {tab === 'violations' && <Violations onExpired={logout} />}
        {tab === 'analytics' && <Analytics onExpired={logout} />}
      </main>
    </div>
  );
}
