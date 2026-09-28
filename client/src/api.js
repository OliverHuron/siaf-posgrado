const KEY = 'siaf_posgrado_token';

export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = t => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* modo privado */ } };

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `Error ${status}`);
    this.status = status;
    this.data = data;
  }
}

/**
 * Sesión caducada/inválida: limpia el token y manda al acceso, para que no se
 * quede "viendo" el panel sin poder hacer nada.
 */
function sesionExpirada() {
  setToken(null);
  try {
    if (!window.location.pathname.startsWith('/staff/acceso')) window.location.href = '/staff/acceso';
  } catch { /* noop */ }
}

export async function api(path, { method, body } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/auth/login') sesionExpirada();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
