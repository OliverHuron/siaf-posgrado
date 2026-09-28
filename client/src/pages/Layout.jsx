import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import ClaseForm from '../components/ClaseForm.jsx';
import PasswordModal from '../components/PasswordModal.jsx';

const I = {
  salones: <path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6M3 21h18" />,
  horario: <path d="M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 10h18M8 3v4M16 3v4" />,
  importar: <path d="M12 3v12M7 10l5 5 5-5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
};

function Ic({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  );
}

const TITULOS = [
  [/\/staff\/salones$/, 'Mapa de salones'],
  [/\/staff\/horario$/, 'Horario de clases'],
  [/\/staff\/importar$/, 'Importar horario'],
];

const ROLES = { admin: 'Administrador', consulta: 'Consulta' };

export default function StaffLayout() {
  const { staff, logoutStaff } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const esAdmin = staff.rol === 'admin';
  const titulo = (TITULOS.find(([re]) => re.test(loc.pathname)) || [, 'Salones de Posgrado'])[1];
  const iniciales = (staff.nombre || staff.usuario || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const link = ({ isActive }) => (isActive ? 'activo' : '');

  // Cierra la sesión sola en cuanto el token caduca.
  useEffect(() => {
    if (!staff?.exp) return undefined;
    const ms = staff.exp * 1000 - Date.now();
    const salir = () => { logoutStaff(); nav('/staff/acceso', { replace: true }); };
    if (ms <= 0) { salir(); return undefined; }
    const t = setTimeout(salir, Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [staff?.exp, logoutStaff, nav]);

  // ---- Datos compartidos por las páginas ----
  const [salones, setSalones] = useState([]);
  const [clases, setClases] = useState([]);
  const [gcal, setGcal] = useState({ habilitado: false });
  const [err, setErr] = useState('');
  const [aviso, setAviso] = useState(null);
  const [modal, setModal] = useState(null); // {tipo: 'clase', clase, preset} | {tipo: 'password'}

  const avisar = useCallback((t) => setAviso({ t, id: Date.now() }), []);
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 4500);
    return () => clearTimeout(t);
  }, [aviso]);

  const cargarClases = useCallback(() => api('/clases').then(setClases), []);
  const cargarSalones = useCallback(() => api('/salones').then(setSalones), []);
  useEffect(() => {
    Promise.all([cargarSalones(), cargarClases(), api('/gcal/estado').then(setGcal)])
      .catch((e) => setErr(e.message));
  }, [cargarSalones, cargarClases]);

  const salonesPorId = useMemo(() => Object.fromEntries(salones.map((s) => [s.id, s])), [salones]);
  const programas = useMemo(() => [...new Set(clases.map((c) => c.programa))].sort((a, b) => a.localeCompare(b, 'es')), [clases]);

  const actualizarSalon = useCallback(async (id, cambios) => {
    try {
      const s = await api(`/salones/${id}`, { method: 'PATCH', body: cambios });
      setSalones((xs) => xs.map((x) => (x.id === id ? s : x)));
    } catch (e) { avisar(e.message); }
  }, [avisar]);

  const actualizarClase = useCallback(async function upd(id, cambios, forzar = false) {
    try {
      const c = await api(`/clases/${id}`, { method: 'PUT', body: { ...cambios, forzar } });
      setClases((xs) => xs.map((x) => (x.id === id ? c : x)));
    } catch (e) {
      if (e.status === 409 && !forzar && window.confirm(`${e.message}. ¿Guardar de todos modos?`)) return upd(id, cambios, true);
      avisar(e.message);
    }
  }, [avisar]);

  const editarClase = useCallback((clase, preset) => setModal({ tipo: 'clase', clase, preset }), []);

  const datos = {
    staff, esAdmin, salones, clases, gcal, salonesPorId, programas,
    cargarClases, cargarSalones, actualizarSalon, actualizarClase, editarClase, avisar,
  };

  return (
    <div className="shell">
      <aside className="shell-side">
        <div className="shell-brand">
          <img className="logo" src="/umsnh_logo.png" alt="UMSNH" />
        </div>
        <nav>
          <NavLink to="/staff/salones" className={link}><Ic d={I.salones} />Salones</NavLink>
          <NavLink to="/staff/horario" className={link}><Ic d={I.horario} />Horario</NavLink>
          {esAdmin && <NavLink to="/staff/importar" className={link}><Ic d={I.importar} />Importar horario</NavLink>}
        </nav>
        <img className="mascota" src="/zorro-mitad.png" alt="" aria-hidden="true" />
        <div className="pie">#HumanistaPorSiempre</div>
      </aside>

      <header className="shell-top">
        <span className="titulo">{titulo}</span>
        <div className="usuario">
          <button type="button" className="perfil" title="Cambiar contraseña" onClick={() => setModal({ tipo: 'password' })}>
            <div className="datos">
              <div className="n">{staff.nombre || staff.usuario}</div>
              <div className="r">{ROLES[staff.rol] || staff.rol}</div>
            </div>
            <div className="avatar">{iniciales}</div>
          </button>
          <button onClick={() => { logoutStaff(); nav('/staff/acceso'); }}>Salir</button>
        </div>
      </header>

      <main className="shell-main">
        {err && <div className="aviso error">{err}</div>}
        <Outlet context={datos} />
      </main>

      {modal?.tipo === 'clase' && (
        <ClaseForm clase={modal.clase} preset={modal.preset} clases={clases} salones={salones} programas={programas}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargarClases(); avisar('Horario actualizado'); }} />
      )}
      {modal?.tipo === 'password' && <PasswordModal onCerrar={() => setModal(null)} avisar={avisar} />}

      {aviso && <div key={aviso.id} className="toast" role="status">{aviso.t}</div>}
    </div>
  );
}
