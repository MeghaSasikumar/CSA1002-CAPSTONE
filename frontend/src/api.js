// Small helper for talking to the backend. Token is kept in the browser's localStorage.
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('ps_user')); } catch { return null; }
};
export const saveSession = (user, token) => {
  localStorage.setItem('ps_user', JSON.stringify(user));
  localStorage.setItem('ps_token', token);
};
export const clearSession = () => {
  localStorage.removeItem('ps_user');
  localStorage.removeItem('ps_token');
};

export async function api(path, method = 'GET', body) {
  const token = localStorage.getItem('ps_token');
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401) clearSession();
  if (!res.ok) throw new Error((data && data.error) || 'Request failed (' + res.status + ')');
  return data;
}
