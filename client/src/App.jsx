import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';

import StaffLogin from './pages/Login.jsx';
import StaffLayout from './pages/Layout.jsx';
import Salones from './pages/Salones.jsx';
import Horario from './pages/Horario.jsx';
const Importar = lazy(() => import('./pages/Importar.jsx'));

function RequiereStaff({ roles, children }) {
  const { staff } = useAuth();
  if (!staff) return <Navigate to="/staff/acceso" replace />;
  if (roles && !roles.includes(staff.rol)) {
    return (
      <div className="wrap">
        <h1>Sin permiso</h1>
        <p className="sub">Tu rol ({staff.rol}) no tiene acceso a esta sección.</p>
        <Link to="/staff">← Volver</Link>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/staff" replace />} />

        <Route path="/staff/acceso" element={<StaffLogin destino="/staff" />} />
        <Route path="/staff" element={<RequiereStaff><StaffLayout /></RequiereStaff>}>
          <Route index element={<Navigate to="salones" replace />} />
          <Route path="salones" element={<Salones />} />
          <Route path="horario" element={<Horario />} />
          <Route path="importar" element={<RequiereStaff roles={['admin']}><Suspense fallback={<p>Cargando…</p>}><Importar /></Suspense></RequiereStaff>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
