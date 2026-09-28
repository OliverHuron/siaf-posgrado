import { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { DIAS, hm, seEnciman } from '../lib/tiempo.js';

const VACIA = { programa: '', materia: '', tipo: 'semestral', profesor: '', fecha_inicio: '', fecha_fin: '',
  dia: 1, hora_inicio: '07:00', hora_fin: '09:00', salon_id: '', alumnos: '', notas: '' };

export default function ClaseForm({ clase, preset, clases, salones, programas, onCerrar, onGuardado }) {
  const [f, setF] = useState(() => {
    const base = clase
      ? { ...VACIA, ...Object.fromEntries(Object.entries(clase).map(([k, v]) => [k, v ?? ''])) }
      : { ...VACIA, ...preset };
    return { ...base, hora_inicio: hm(base.hora_inicio), hora_fin: hm(base.hora_fin) };
  });
  const [error, setError] = useState(null);
  const [conflictos, setConflictos] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  // Disponibilidad de cada salón para el horario capturado.
  const ocupacion = useMemo(() => {
    const c = { ...f, dia: Number(f.dia), fecha_inicio: f.fecha_inicio || null, fecha_fin: f.fecha_fin || null };
    const m = {};
    for (const o of clases) if (o.salon_id && o.id !== clase?.id && seEnciman(c, o)) m[o.salon_id] = o;
    return m;
  }, [f, clases, clase]);

  const guardar = async (forzar = false) => {
    setEnviando(true); setError(null);
    try {
      const body = { ...f, dia: Number(f.dia), salon_id: f.salon_id ? Number(f.salon_id) : null,
        alumnos: f.alumnos === '' ? null : Number(f.alumnos), forzar };
      await (clase ? api(`/clases/${clase.id}`, { method: 'PUT', body }) : api('/clases', { method: 'POST', body }));
      onGuardado();
    } catch (e) {
      if (e.status === 409) setConflictos({ msg: e.message, lista: e.data?.conflictos || [] });
      else setError(e.message);
    } finally { setEnviando(false); }
  };

  const borrar = async () => {
    if (!window.confirm('¿Eliminar esta clase del horario? También se quitará de Google Calendar.')) return;
    try { await api(`/clases/${clase.id}`, { method: 'DELETE' }); onGuardado(); } catch (e) { setError(e.message); }
  };

  const asignables = salones.filter(s => s.asignable || String(s.id) === String(f.salon_id));

  const pie = (
    <>
      {clase && <button type="button" className="plano peligro-txt" onClick={borrar}>Eliminar</button>}
      <span className="spacer" />
      <button type="button" className="plano" onClick={onCerrar}>Cancelar</button>
      <button type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
    </>
  );

  return (
    <Modal titulo={clase ? "Editar clase" : "Nueva clase"} onCerrar={onCerrar} ancho={640} as="form"
      onSubmit={e => { e.preventDefault(); guardar(); }} pie={pie}>
      {error && <div className="aviso error">{error}</div>}
      {conflictos && (
        <div className="aviso alerta">
          <strong>{conflictos.msg}</strong>
          {conflictos.lista.map(c => <div key={c.id}>{DIAS[c.dia]} {hm(c.hora_inicio)}–{hm(c.hora_fin)} · {c.materia || c.programa}{c.profesor ? ` · ${c.profesor}` : ""}</div>)}
          <button type="button" className="peligro mini" style={{ marginTop: 8 }} onClick={() => guardar(true)}>Guardar de todos modos</button>
        </div>
      )}
      <div className="grid2">
        <div className="span2"><label>Programa (posgrado)</label>
          <input type="text" list="programas" required value={f.programa} onChange={set("programa")} />
          <datalist id="programas">{programas.map(p => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="span2"><label>Materia</label><input type="text" value={f.materia} onChange={set("materia")} /></div>
        <div className="span2"><label>Profesor(a)</label><input type="text" value={f.profesor} onChange={set("profesor")} /></div>
        <div><label>Tipo de curso</label>
          <select value={f.tipo} onChange={set("tipo")}>
            <option value="semestral">Semestral</option><option value="trimestral">Trimestral</option><option value="otro">Otro</option>
          </select>
        </div>
        <div><label>Día</label>
          <select value={f.dia} onChange={set("dia")}>{[1, 2, 3, 4, 5, 6, 0].map(i => <option key={i} value={i}>{DIAS[i]}</option>)}</select>
        </div>
        <div><label>Hora inicio</label><input type="time" required step="1800" value={f.hora_inicio} onChange={set("hora_inicio")} /></div>
        <div><label>Hora fin</label><input type="time" required step="1800" value={f.hora_fin} onChange={set("hora_fin")} /></div>
        <div><label>Inicio del curso</label><input type="date" value={f.fecha_inicio} onChange={set("fecha_inicio")} /></div>
        <div><label>Fin del curso</label><input type="date" value={f.fecha_fin} onChange={set("fecha_fin")} /></div>
        <div><label>Salón</label>
          <select value={f.salon_id} onChange={set("salon_id")}>
            <option value="">Sin asignar</option>
            {asignables.map(s => {
              const o = ocupacion[s.id];
              return <option key={s.id} value={s.id}>
                {s.nombre} ({s.mesas * 2} sillas){s.fuera_servicio ? " · fuera de servicio" : o ? ` · ocupado: ${o.materia || o.programa}` : " · libre"}
              </option>;
            })}
          </select>
        </div>
        <div><label>Alumnos</label><input type="number" min="0" value={f.alumnos} onChange={set("alumnos")} /></div>
        <div className="span2"><label>Notas</label><textarea rows={2} value={f.notas} onChange={set("notas")} /></div>
      </div>
    </Modal>
  );
}
