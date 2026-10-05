import { useCallback, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { PLANTAS, claseEnMomento, eventoEnMomento, fechaISO } from '../lib/tiempo.js';
import CalendarPanel from '../components/CalendarPanel.jsx';
import FloorMap from '../components/FloorMap.jsx';
import InfoPanel from '../components/InfoPanel.jsx';
import { MesaDefs } from '../components/Mesas.jsx';

export default function Salones() {
  const {
    esAdmin, salones, clases, gcal, salonesPorId, programas,
    actualizarSalon, actualizarClase, editarClase, avisar,
  } = useOutletContext();

  const [eventosGcal, setEventosGcal] = useState([]);
  const [planta, setPlanta] = useState('baja');
  const [salonSel, setSalonSel] = useState(null);
  const [momento, setMomentoRaw] = useState(() => new Date());
  const [eventoSel, setEventoSel] = useState(null);
  const [ocultos, setOcultos] = useState(() => new Set()); // programas ocultos en el calendario
  const [simulados, setSimulados] = useState({}); // salon_id -> alumnos simulados (no se guarda)
  // Calendario o mapa: se muestra uno a la vez para que cada uno tenga todo el ancho.
  const [principal, setPrincipalRaw] = useState(() => {
    try { return localStorage.getItem('siaf_posgrado_vista') || 'calendario'; } catch { return 'calendario'; }
  });
  const setPrincipal = (v) => {
    setPrincipalRaw(v);
    try { localStorage.setItem('siaf_posgrado_vista', v); } catch { /* sin storage */ }
  };

  const cargarGcal = useCallback((inicio, fin) => {
    if (!gcal.habilitado) return;
    api(`/gcal/eventos?start=${encodeURIComponent(inicio.toISOString())}&end=${encodeURIComponent(fin.toISOString())}`)
      .then(setEventosGcal)
      .catch((e) => avisar(`Google Calendar: ${e.message}`));
  }, [gcal.habilitado, avisar]);

  // Estado de cada salón en el instante consultado.
  const estados = useMemo(() => {
    const m = {};
    for (const s of salones) {
      const clase = clases.find((c) => c.salon_id === s.id && claseEnMomento(c, momento)) || null;
      const evento = clase ? null : eventosGcal.find((e) => e.salon_id === s.id && eventoEnMomento(e, momento)) || null;
      const estado = s.fuera_servicio ? 'fuera' : clase || evento ? 'ocupado' : s.asignable ? 'libre' : 'na';
      // Sin clase en curso, se usan los alumnos simulados desde el panel (mapa y croquis coinciden).
      m[s.id] = { estado, clase, evento, alumnos: clase ? (clase.alumnos ?? 0) : (simulados[s.id] ?? 0) };
    }
    return m;
  }, [salones, clases, eventosGcal, momento, simulados]);

  const conteos = useMemo(() => Object.fromEntries(PLANTAS.map((p) => {
    const asig = salones.filter((s) => s.planta === p.id && s.asignable);
    return [p.id, { total: asig.length, ocupados: asig.filter((s) => estados[s.id]?.estado === 'ocupado').length }];
  })), [salones, estados]);

  // "Consultando" = se eligió otro día/hora; volver a ahora (✕ u "Hoy") lo apaga.
  const [consultando, setConsultando] = useState(false);
  const setMomento = useCallback((d) => {
    setMomentoRaw(d);
    setConsultando(Math.abs(d - Date.now()) > 60 * 1000);
    setEventoSel(null);
  }, []);

  const seleccionar = useCallback((id) => {
    setSalonSel(id);
    const s = id && salonesPorId[id];
    if (s) setPlanta(s.planta);
  }, [salonesPorId]);

  const onClaseClick = (c, inicio) => {
    setMomento(inicio ? new Date(inicio) : momento);
    if (c.salon_id) seleccionar(c.salon_id);
    else { setSalonSel(null); if (esAdmin) editarClase(c); }
  };

  const onEventoClick = (e) => {
    setMomentoRaw(new Date(e.inicio));
    setEventoSel(e);
    if (e.salon_id) seleccionar(e.salon_id); else setSalonSel(null);
  };

  // Una clase nueva arranca en el día/hora que se está consultando.
  const nuevaClase = (preset = {}) => {
    const h = momento.getHours();
    const p2 = (n) => String(n).padStart(2, '0');
    editarClase(null, {
      dia: momento.getDay(), hora_inicio: `${p2(h)}:00`, hora_fin: `${p2(Math.min(h + 2, 23))}:00`,
      fecha_inicio: fechaISO(momento), ...preset,
    });
  };
  const onEditarClase = (clase, preset) => (clase ? editarClase(clase) : nuevaClase(preset));

  const sincronizar = async () => {
    try {
      const r = await api('/gcal/sincronizar', { method: 'POST' });
      avisar(`Google Calendar: ${r.ok} de ${r.total} clases sincronizadas${r.errores.length ? ` · ${r.errores.length} errores` : ''}`);
    } catch (e) { avisar(e.message); }
  };

  const salon = salonSel ? salonesPorId[salonSel] : null;
  const sinSalon = clases.filter((c) => !c.salon_id).length;

  return (
    <div className="tablero">
      <MesaDefs />
      <div className="tablero-barra">
        <div className="segmento" role="tablist" aria-label="Vista principal">
          <button type="button" role="tab" aria-selected={principal === 'calendario'}
            className={principal === 'calendario' ? 'on' : ''} onClick={() => setPrincipal('calendario')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 10h18M8 3v4M16 3v4" />
            </svg>
            Calendario
          </button>
          <button type="button" role="tab" aria-selected={principal === 'mapa'}
            className={principal === 'mapa' ? 'on' : ''} onClick={() => setPrincipal('mapa')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />
            </svg>
            Mapa
          </button>
        </div>
        <div className="fila">
          {sinSalon > 0 && <span className="pill alerta" title="Clases del horario sin salón asignado">{sinSalon} clases sin salón</span>}
          {gcal.habilitado && <span className="pill ok" title={gcal.calendarId}>Google Calendar conectado</span>}
          {esAdmin && gcal.habilitado && <button className="plano mini" onClick={sincronizar}>Sincronizar calendario</button>}
          {esAdmin && <button className="mini" onClick={() => nuevaClase()}>+ Nueva clase</button>}
        </div>
      </div>

      <div className="columnas">
        {/* Ambos quedan montados (conservan semana, vista y zoom); solo se oculta el inactivo. */}
        <div className={`principal ${principal === 'calendario' ? '' : 'oculto'}`}>
          <CalendarPanel clases={clases} salonesPorId={salonesPorId} eventosGcal={eventosGcal} cargarGcal={cargarGcal}
            momento={momento} setMomento={setMomento} consultando={consultando} salonSel={salonSel} visible={principal === 'calendario'}
            onClaseClick={onClaseClick} onEventoClick={onEventoClick}
            programas={programas} ocultos={ocultos} setOcultos={setOcultos} />
        </div>
        <div className={`principal ${principal === 'mapa' ? '' : 'oculto'}`}>
          <FloorMap planta={planta} setPlanta={setPlanta} salones={salones} estados={estados}
            salonSel={salonSel} onSelect={seleccionar} conteos={conteos} esAdmin={esAdmin} />
        </div>

        <aside className="lateral">
          <InfoPanel salon={salon} momento={momento} setMomento={setMomento} estados={estados}
            clases={clases} salones={salones} salonesPorId={salonesPorId} eventosGcal={eventosGcal}
            eventoSel={eventoSel} consultando={consultando} esAdmin={esAdmin} onEditarClase={onEditarClase}
            onActualizarSalon={actualizarSalon} onActualizarClase={actualizarClase} onSelect={seleccionar}
            onSimular={(id, n) => setSimulados((m) => ({ ...m, [id]: n }))}
            onVerEnMapa={principal === 'calendario' ? () => setPrincipal('mapa') : null} />
        </aside>
      </div>
    </div>
  );
}
