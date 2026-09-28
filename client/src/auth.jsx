import { createContext, useContext, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);

function decodeJwt(t) {
  try {
    const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binario = atob(b64);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(() => {
    const t = getToken();
    const u = t ? decodeJwt(t) : null;
    return u && u.exp * 1000 > Date.now() ? u : null;
  });

  const loginStaff = useCallback(async (usuario, password) => {
    const r = await api('/auth/login', { body: { usuario, password } });
    setToken(r.token);
    setStaff({ ...decodeJwt(r.token), ...r.user });
    return r.user;
  }, []);

  const logoutStaff = useCallback(() => {
    setToken(null);
    setStaff(null);
  }, []);

  return (
    <Ctx.Provider value={{ staff, loginStaff, logoutStaff }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
