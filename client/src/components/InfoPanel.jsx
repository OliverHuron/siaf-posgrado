import React, { useEffect, useMemo, useState } from 'react';
import Mesas from './Mesas.jsx';
import { DIAS, PLANTAS, claseEnMomento, fechaISO, fmtFecha, fmtFechaCorta, hm, horaHM, seEnciman, tituloClase } from '../lib/tiempo.js';

const TIPOS = { aula: 'Aula', computo: 'Laboratorio de cómputo', sala: 'Sala', cubiculo: 'Cubículo', otro: 'Otro espacio' };
const ESTADO = { ocupado: 'Ocupado', libre: 'Libre', fuera: 'Fuera de servicio', na: 'No asignable' };

function NumeroEditable({ valor, onGuardar, min = 0, max = 999, deshabilitado, etiqueta }) {
  const [v, setV] = useState(valor ?? '');
  useEffect(() => setV(valor ?? ''), [valor]);
  const guardar = x => {
    const n = x === '' ? null : Math.min(max, Math.max(min, Math.round(Number(x))));
    if (n !== (valor ?? null) && !Number.isNaN(n)) onGuardar(n);
    setV(n ?? '');
  };
  return (
    <div className="stepper" aria-label={etiqueta}>
      <button className="icono-btn" disabled={deshabilitado} onClick={() => guardar(Math.max(min, Number(v || 0) - 1))} aria-label={`Menos ${etiqueta}`}>−</button>
      <input type="number" min={min} max={max} value={v} disabled={deshabilitado}
        onChange={e => setV(e.target.value)} onBlur={e => guardar(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
      <button className="icono-btn" disabled={deshabilitado} onClick={() => guardar(Math.min(max, Number(v || 0) + 1))} aria-label={`Más ${etiqueta}`}>+</button>
    </div>
  );
}

function TarjetaClase({ c, salon, activa, onEditar, esAdmin }) {
  return (
    <div className={`tarjeta ${activa ? 'activa' : ''}`}>
      <div className="tarjeta-top">
        <strong>{tituloClase(c)}</strong>
        {esAdmin && <button className="link" onClick={() => onEditar(c)}>Editar</button>}
      </div>
      {c.materia && <div className="muted">{c.programa}</div>}
      <div className="muted">{DIAS[c.dia]} {hm(c.hora_inicio)}–{hm(c.hora_fin)}{salon ? ` · ${salon.nombre}` : ''}</div>
      {c.profesor && <div>{c.profesor}</div>}
      <div className="muted small">{fmtFechaCorta(c.fecha_inicio)} → {fmtFechaCorta(c.fecha_fin)} · {c.tipo}{c.alumnos != null ? ` · ${c.alumnos} alumnos` : ''}</div>
    </div>
  );
}

export default function InfoPanel(props) {
  return props.salon ? <PanelSalon {...props} /> : <PanelMomento {...props} />;
}

function SelectorMomento({ momento, setMomento }) {
  const valor = `${fechaISO(momento)}T${horaHM(momento)}`;
  return (
    <label className="campo">
      <span>Día y hora consultados</span>
      <input type="datetime-local" value={valor} step="1800"
        onChange={e => e.target.value && setMomento(new Date(e.target.value))} />
    </label>
  );
}

function PanelSalon({ salon, momento, setMomento, estados, clases, salonesPorId, esAdmin, onEditarClase,
  onActualizarSalon, onActualizarClase, onSelect }) {
  const st = estados[salon.id] || { estado: 'na' };
  const [simulados, setSimulados] = useState(0);
  const [asignarId, setAsignarId] = useState('');
  useEffect(() => { setSimulados(0); setAsignarId(''); }, [salon.id]);

  const delSalon = useMemo(() => clases.filter(c => c.salon_id === salon.id)
    .sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7) || hm(a.hora_inicio).localeCompare(hm(b.hora_inicio))), [clases, salon.id]);
  const sinSalon = useMemo(() => clases.filter(c => !c.salon_id)
    .map(c => ({ c, choca: delSalon.some(o => seEnciman(c, o)) })), [clases, delSalon]);

  const sillas = salon.mesas * 2;
  const alumnos = st.clase ? (st.clase.alumnos ?? 0) : simulados;
  const exceso = alumnos > sillas;
  const planta = PLANTAS.find(p => p.id === salon.planta)?.nombre;

  const porDia = DIAS.map((d, i) => ({ d, i, cs: delSalon.filter(c => c.dia === i) })).filter(x => x.cs.length);
  const ordenDias = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>{salon.nombre}</h2>
          <div className="muted">{salon.codigo} · {planta} · {TIPOS[salon.tipo]}</div>
        </div>
        <button className="icono-btn" onClick={() => onSelect(null)} aria-label="Cerrar">✕</button>
      </div>

      <div className={`estado-chip ${st.estado}`}>{ESTADO[st.estado]}{st.estado !== 'fuera' && <span> · {fmtFecha(momento)}, {horaHM(momento)}</span>}</div>
      {salon.fuera_servicio && salon.motivo && <p className="aviso alerta">{salon.motivo}</p>}

      {st.clase && <TarjetaClase c={st.clase} salon={salon} activa esAdmin={esAdmin} onEditar={onEditarClase} />}
      {st.evento && (
        <div className="tarjeta activa gcal">
          <strong>{st.evento.titulo}</strong>
          <div className="muted">Evento de Google Calendar · {new Date(st.evento.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}–{new Date(st.evento.fin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
          {st.evento.enlace && <a href={st.evento.enlace} target="_blank" rel="noreferrer">Abrir en Google Calendar</a>}
        </div>
      )}

      <section>
        <h3>Mobiliario y alumnos</h3>
        <div className="fila-campos">
          <div className="campo">
            <span>Mesas (2 sillas c/u)</span>
            <NumeroEditable etiqueta="mesas" valor={salon.mesas} max={60} deshabilitado={!esAdmin}
              onGuardar={n => onActualizarSalon(salon.id, { mesas: n ?? 0 })} />
          </div>
          <div className="campo">
            <span>{st.clase ? 'Alumnos de la clase' : 'Alumnos (simulación)'}</span>
            {st.clase
              ? <NumeroEditable etiqueta="alumnos" valor={st.clase.alumnos} max={200} deshabilitado={!esAdmin}
                  onGuardar={n => onActualizarClase(st.clase.id, { alumnos: n })} />
              : <NumeroEditable etiqueta="alumnos" valor={simulados} max={200} onGuardar={n => setSimulados(n ?? 0)} />}
          </div>
        </div>
        <div className={`capacidad ${exceso ? 'exceso' : ''}`}>
          <div className="barra"><div style={{ width: `${sillas ? Math.min(100, (alumnos / sillas) * 100) : 0}%` }} /></div>
          <span>{alumnos} de {sillas} sillas ocupadas{exceso ? ` · faltan ${alumnos - sillas} sillas` : ''}</span>
        </div>
        {salon.mesas > 0 && (
          <svg className="croquis" viewBox={`-10 -10 ${salon.w + 20} ${salon.h + 20}`} role="img"
            aria-label={`Acomodo de ${salon.mesas} mesas, ${alumnos} alumnos`}>
            <rect x="-6" y="-6" width={salon.w + 12} height={salon.h + 12} className="croquis-muro" />
            <Mesas x={30} y={20} w={salon.w - 60} h={salon.h - 40} mesas={salon.mesas} alumnos={alumnos} />
          </svg>
        )}
      </section>

      <section>
        <div className="sec-head">
          <h3>Horario semanal ({delSalon.length})</h3>
          {esAdmin && salon.asignable && <button className="mini" onClick={() => onEditarClase(null, { salon_id: salon.id })}>+ Nueva clase</button>}
        </div>
        {!delSalon.length && <p className="muted">Sin clases asignadas.</p>}
        {ordenDias.map(i => porDia.find(x => x.i === i)).filter(Boolean).map(({ d, cs }) => (
          <div key={d} className="dia-grupo">
            <div className="dia-nombre">{d}</div>
            {cs.map(c => (
              <button key={c.id} className={`fila-clase ${claseEnMomento(c, momento) ? 'activa' : ''}`}
                onClick={() => esAdmin ? onEditarClase(c) : null} title={c.profesor || ''}>
                <span className="hora">{hm(c.hora_inicio)}–{hm(c.hora_fin)}</span>
                <span className="txt">{tituloClase(c)}<small>{c.materia ? c.programa : c.profesor}</small></span>
              </button>
            ))}
          </div>
        ))}
      </section>

      {esAdmin && salon.asignable && sinSalon.length > 0 && (
        <section>
          <h3>Asignar clase sin salón</h3>
          <div className="fila-campos">
            <select value={asignarId} onChange={e => setAsignarId(e.target.value)}>
              <option value="">Elige una clase…</option>
              {sinSalon.map(({ c, choca }) => (
                <option key={c.id} value={c.id} disabled={choca}>
                  {DIAS[c.dia].slice(0, 3)} {hm(c.hora_inicio)}–{hm(c.hora_fin)} · {tituloClase(c)}{choca ? ' (choca)' : ''}
                </option>
              ))}
            </select>
            <button disabled={!asignarId} onClick={() => onActualizarClase(Number(asignarId), { salon_id: salon.id })}>Asignar</button>
          </div>
        </section>
      )}

      {esAdmin && (
        <section>
          <h3>Estado del salón</h3>
          <label className="check">
            <input type="checkbox" checked={salon.fuera_servicio}
              onChange={e => onActualizarSalon(salon.id, { fuera_servicio: e.target.checked })} />
            Fuera de servicio
          </label>
          <label className="check">
            <input type="checkbox" checked={salon.asignable}
              onChange={e => onActualizarSalon(salon.id, { asignable: e.target.checked })} />
            Se puede asignar a clases
          </label>
          <TextoEditable etiqueta="Motivo / notas" valor={salon.fuera_servicio ? salon.motivo : salon.notas}
            onGuardar={t => onActualizarSalon(salon.id, salon.fuera_servicio ? { motivo: t } : { notas: t })} />
        </section>
      )}
      {!esAdmin && salon.notas && <p className="muted">{salon.notas}</p>}
      <p className="muted small">Consultando: <button className="link" onClick={() => setMomento(new Date())}>volver a ahora</button></p>
    </div>
  );
}

function TextoEditable({ valor, onGuardar, etiqueta }) {
  const [t, setT] = useState(valor || '');
  useEffect(() => setT(valor || ''), [valor]);
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <textarea rows={2} value={t} onChange={e => setT(e.target.value)}
        onBlur={() => t !== (valor || '') && onGuardar(t)} />
    </label>
  );
}

function PanelMomento({ momento, setMomento, estados, clases, salones, salonesPorId, eventosGcal, esAdmin, onEditarClase, onSelect, eventoSel }) {
  const asignables = salones.filter(s => s.asignable);
  const ocupados = asignables.filter(s => estados[s.id]?.estado === 'ocupado');
  const libres = asignables.filter(s => estados[s.id]?.estado === 'libre');
  const fuera = salones.filter(s => s.fuera_servicio);
  const sinSalonAhora = clases.filter(c => !c.salon_id && claseEnMomento(c, momento));
  const sinSalon = clases.filter(c => !c.salon_id);
  const eventosSinSalon = eventosGcal.filter(e => !e.salon_id && !e.todoElDia && new Date(e.inicio) <= momento && momento < new Date(e.fin));

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>{fmtFecha(momento)}</h2>
          <div className="muted">{horaHM(momento)} h · selecciona un salón en el mapa o una hora en el calendario</div>
        </div>
      </div>
      <SelectorMomento momento={momento} setMomento={setMomento} />

      {eventoSel && (
        <div className="tarjeta activa gcal">
          <strong>{eventoSel.titulo}</strong>
          <div className="muted">Evento de Google Calendar{eventoSel.ubicacion ? ` · ${eventoSel.ubicacion}` : ''}</div>
          {eventoSel.descripcion && <div className="small">{eventoSel.descripcion}</div>}
          {eventoSel.enlace && <a href={eventoSel.enlace} target="_blank" rel="noreferrer">Abrir en Google Calendar</a>}
        </div>
      )}

      <div className="resumen">
        <div><b>{ocupados.length}</b><span>ocupados</span></div>
        <div><b>{libres.length}</b><span>libres</span></div>
        <div><b>{fuera.length}</b><span>fuera de servicio</span></div>
      </div>

      <section>
        <h3>En uso a esta hora</h3>
        {!ocupados.length && <p className="muted">Ningún salón ocupado.</p>}
        {ocupados.map(s => {
          const st = estados[s.id];
          return (
            <button key={s.id} className="fila-clase activa" onClick={() => onSelect(s.id)}>
              <span className="hora">{s.nombre}</span>
              <span className="txt">
                {st.clase ? tituloClase(st.clase) : st.evento?.titulo}
                <small>{st.clase ? `${hm(st.clase.hora_inicio)}–${hm(st.clase.hora_fin)} · ${st.clase.profesor || st.clase.programa}` : 'Google Calendar'}</small>
              </span>
            </button>
          );
        })}
      </section>

      <section>
        <h3>Libres</h3>
        <div className="chips">
          {libres.map(s => <button key={s.id} className="chip" onClick={() => onSelect(s.id)}>{s.nombre}</button>)}
          {fuera.map(s => <button key={s.id} className="chip fuera" onClick={() => onSelect(s.id)} title={s.motivo || ''}>{s.nombre} ⚠</button>)}
        </div>
      </section>

      {(sinSalonAhora.length > 0 || eventosSinSalon.length > 0) && (
        <section>
          <h3>A esta hora sin salón</h3>
          {sinSalonAhora.map(c => <TarjetaClase key={c.id} c={c} esAdmin={esAdmin} onEditar={onEditarClase} />)}
          {eventosSinSalon.map(e => (
            <div key={e.id} className="tarjeta gcal"><strong>{e.titulo}</strong><div className="muted">{e.ubicacion || 'Sin ubicación'} · Google Calendar</div></div>
          ))}
        </section>
      )}

      {sinSalon.length > 0 && (
        <p className="muted small">{sinSalon.length} clase(s) del horario no tienen salón. Selecciona un salón libre para asignarlas.</p>
      )}
    </div>
  );
}
