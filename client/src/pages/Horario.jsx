import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DIAS, colorPrograma, fmtFechaCorta, hm, norm } from '../lib/tiempo.js';

const ORDEN_DIA = (d) => (d + 6) % 7; // lunes primero

export default function Horario() {
  const { esAdmin, clases, salones, salonesPorId, programas, editarClase } = useOutletContext();
  const [f, setF] = useState({ programa: '', dia: '', salon: '', texto: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const filas = useMemo(() => {
    const t = norm(f.texto);
    return clases
      .filter((c) => !f.programa || c.programa === f.programa)
      .filter((c) => f.dia === '' || c.dia === Number(f.dia))
      .filter((c) => !f.salon || (f.salon === 'sin' ? !c.salon_id : c.salon_id === Number(f.salon)))
      .filter((c) => !t || norm([c.programa, c.materia, c.profesor].join(' ')).includes(t))
      .sort((a, b) => ORDEN_DIA(a.dia) - ORDEN_DIA(b.dia) || hm(a.hora_inicio).localeCompare(hm(b.hora_inicio))
        || a.programa.localeCompare(b.programa, 'es'));
  }, [clases, f]);

  const asignables = salones.filter((s) => s.asignable);

  return (
    <div className="wrap-pagina">
      <div className="fila fila-sep">
        <div>
          <h1>Horario de clases</h1>
          <p className="sub">{clases.length} sesiones semanales · {clases.filter((c) => !c.salon_id).length} sin salón</p>
        </div>
        {esAdmin && <button onClick={() => editarClase(null, {})}>+ Nueva clase</button>}
      </div>

      <div className="card">
        <div className="fila">
          <select value={f.programa} onChange={set('programa')} style={{ width: 'auto', maxWidth: 320 }}>
            <option value="">Todos los programas</option>
            {programas.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={f.dia} onChange={set('dia')} style={{ width: 'auto' }}>
            <option value="">Todos los días</option>
            {[1, 2, 3, 4, 5, 6, 0].map((i) => <option key={i} value={i}>{DIAS[i]}</option>)}
          </select>
          <select value={f.salon} onChange={set('salon')} style={{ width: 'auto' }}>
            <option value="">Todos los salones</option>
            <option value="sin">Sin salón</option>
            {asignables.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <input type="search" placeholder="Materia, programa o profesor…" value={f.texto} onChange={set('texto')}
            style={{ flex: 1, minWidth: 180 }} />
        </div>
      </div>

      <div className="card tabla-scroll tabla-siaf">
        <table>
          <thead>
            <tr>
              <th>Día</th>
              <th>Horario</th>
              <th>Materia</th>
              <th>Programa</th>
              <th>Profesor(a)</th>
              <th>Salón</th>
              <th>Periodo</th>
              <th>Alumnos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((c) => {
              const s = salonesPorId[c.salon_id];
              return (
                <tr key={c.id} className={esAdmin ? 'clic' : ''} onClick={() => esAdmin && editarClase(c)}>
                  <td className="nowrap">{DIAS[c.dia]}</td>
                  <td className="nowrap mono">{hm(c.hora_inicio)}–{hm(c.hora_fin)}</td>
                  <td>{c.materia || <span className="hint">—</span>}</td>
                  <td><span className="dot-prog" style={{ background: colorPrograma(c.programa) }} />{c.programa}</td>
                  <td>{c.profesor || <span className="hint">—</span>}</td>
                  <td className="nowrap">
                    {s ? <span className={`pill ${s.fuera_servicio ? 'alerta' : 'azul'}`}>{s.nombre}</span>
                      : <span className="pill mal">Sin salón</span>}
                  </td>
                  <td className="nowrap hint">
                    {c.fecha_inicio || c.fecha_fin ? `${fmtFechaCorta(c.fecha_inicio)} → ${fmtFechaCorta(c.fecha_fin)}` : 'Sin fechas'}
                  </td>
                  <td>{c.alumnos ?? <span className="hint">—</span>}</td>
                </tr>
              );
            })}
            {filas.length === 0 && <tr><td colSpan={8} className="hint">Sin resultados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
