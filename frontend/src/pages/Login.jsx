import React, { useState } from 'react';
import { api, saveSession } from '../api.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const body = mode === 'login' ? { email: form.email, password: form.password } : form;
      const data = await api('/auth/' + mode, 'POST', body);
      saveSession(data.user, data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo big">P</div>
        <h1>ParkSmart</h1>
        <p className="sub">Campus Parking Slot Management and Vehicle Tracking</p>

        {mode === 'register' && (
          <>
            <label>Full name<input value={form.name} onChange={set('name')} required /></label>
            <label>I am a
              <select value={form.role} onChange={set('role')}>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="visitor">Visitor</option>
              </select>
            </label>
          </>
        )}
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Password<input type="password" value={form.password} onChange={set('password')} required /></label>

        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}</button>

        <p className="switch">
          {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </a>
        </p>
      </form>
    </div>
  );
}
