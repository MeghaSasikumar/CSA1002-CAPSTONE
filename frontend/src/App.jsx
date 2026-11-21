import React, { useState } from 'react';
import { getUser, clearSession } from './api.js';
import Login from './pages/Login.jsx';
import Slots from './pages/Slots.jsx';

// Tabs shown per role. More screens (vehicles, gate, bookings, violations, analytics)
// are added to this list as we build them.
const TABS = {
  student: [['slots', 'Parking Slots']],
  staff: [['slots', 'Parking Slots']],
  visitor: [['slots', 'Parking Slots']],
  security: [['slots', 'Parking Slots']],
  admin: [['slots', 'Parking Slots']],
};

export default function App() {
  const [user, setUser] = useState(getUser());
  const [tab, setTab] = useState('slots');

  if (!user) return <Login onLogin={setUser} />;

  const logout = () => { clearSession(); setUser(null); };
  const tabs = TABS[user.role] || [];

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
      </main>
    </div>
  );
}
