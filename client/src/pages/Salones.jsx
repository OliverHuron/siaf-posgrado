import { useCallback, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { PLANTAS, claseEnMomento, eventoEnMomento, fechaISO } from '../lib/tiempo.js';
import CalendarPanel from '../components/CalendarPanel.jsx';
import FloorMap from '../components/FloorMap.jsx';
import InfoPanel from '../components/InfoPanel.jsx';

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
      m[s.id] = { estado, clase, evento, alumnos: clase?.alumnos ?? 0 };
    }
    return m;
  }, [salones, clases, eventosGcal, momento]);

  const conteos = useMemo(() => Object.fromEntries(PLANTAS.map((p) => {
    const asig = salones.filter((s) => s.planta === p.id && s.asignable);
    return [p.id, { total: asig.length, ocupados: asig.filter((s) => estados[s.id]?.estado === 'ocupado').length }];
  })), [salones, estados]);

  const setMomento = useCallback((d) => { setMomentoRaw(d); setEventoSel(null); }, []);

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
      <div className="tablero-barra">
        <div className="fila">
          {sinSalon > 0 && <span className="pill alerta" title="Clases del horario sin salón asignado">{sinSalon} clases sin salón</span>}
          <span className={`pill ${gcal.habilitado ? 'ok' : 'neutro'}`} title={gcal.calendarId || 'Pendiente de configurar en el servidor'}>
            Google Calendar {gcal.habilitado ? 'conectado' : 'no conectado'}
          </span>
        </div>
        {esAdmin && (
          <div className="fila">
            {gcal.habilitado && <button className="plano mini" onClick={sincronizar}>Sincronizar calendario</button>}
            <button className="mini" onClick={() => nuevaClase()}>+ Nueva clase</button>
          </div>
        )}
      </div>

      <div className="columnas">
        <CalendarPanel clases={clases} salonesPorId={salonesPorId} eventosGcal={eventosGcal} cargarGcal={cargarGcal}
          momento={momento} setMomento={setMomento} salonSel={salonSel}
          onClaseClick={onClaseClick} onEventoClick={onEventoClick}
          programas={programas} ocultos={ocultos} setOcultos={setOcultos} />

        <FloorMap planta={planta} setPlanta={setPlanta} salones={salones} estados={estados}
          salonSel={salonSel} onSelect={seleccionar} conteos={conteos} />

        <aside className="lateral">
          <InfoPanel salon={salon} momento={momento} setMomento={setMomento} estados={estados}
            clases={clases} salones={salones} salonesPorId={salonesPorId} eventosGcal={eventosGcal}
            eventoSel={eventoSel} esAdmin={esAdmin} onEditarClase={onEditarClase}
            onActualizarSalon={actualizarSalon} onActualizarClase={actualizarClase} onSelect={seleccionar} />
        </aside>
      </div>
    </div>
  );
}
