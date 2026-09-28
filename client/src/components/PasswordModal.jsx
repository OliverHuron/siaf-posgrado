import { useState } from 'react';
import { api } from '../api.js';
import Modal from './Modal.jsx';

export default function PasswordModal({ onCerrar, avisar }) {
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (f.nueva !== f.repetir) return setError('Las contraseñas no coinciden');
    try {
      await api('/auth/password', { method: 'PUT', body: { actual: f.actual, nueva: f.nueva } });
      avisar('Contraseña actualizada');
      onCerrar();
    } catch (err) { setError(err.message); }
  };

  return (
    <Modal titulo="Cambiar contraseña" onCerrar={onCerrar} ancho={400} as="form" onSubmit={guardar}
      pie={<>
        <button type="button" className="plano" onClick={onCerrar}>Cancelar</button>
        <button type="submit">Guardar</button>
      </>}>
      {error && <div className="aviso error">{error}</div>}
      <label>Contraseña actual</label>
      <input type="password" required autoComplete="current-password" value={f.actual} onChange={set('actual')} />
      <label>Nueva contraseña</label>
      <input type="password" required minLength={8} autoComplete="new-password" value={f.nueva} onChange={set('nueva')} />
      <p className="hint">Mínimo 8 caracteres.</p>
      <label>Repetir nueva contraseña</label>
      <input type="password" required autoComplete="new-password" value={f.repetir} onChange={set('repetir')} />
    </Modal>
  );
}
