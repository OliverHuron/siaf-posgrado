import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { colorPrograma, fechaISO, hm, sumarDias, tituloClase } from '../lib/tiempo.js';

const VISTAS = [
  ['timeGridDay', 'Día'],
  ['timeGridWeek', 'Semana'],
  ['dayGridMonth', 'Mes'],
];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Título como Google Calendar: "Septiembre de 2026", "Sep – Oct de 2026" o "7 de septiembre de 2026".
function tituloVista(view) {
  if (!view) return '';
  const a = view.currentStart, b = new Date(view.currentEnd.getTime() - 1);
  if (view.type === 'timeGridDay') return `${a.getDate()} de ${MESES[a.getMonth()].slice(0, 3)} de ${a.getFullYear()}`;
  if (a.getMonth() === b.getMonth()) return `${cap(MESES[a.getMonth()])} de ${a.getFullYear()}`;
  const m = (d) => cap(MESES[d.getMonth()].slice(0, 3));
  return a.getFullYear() === b.getFullYear()
    ? `${m(a)} – ${m(b)} de ${b.getFullYear()}`
    : `${m(a)} de ${a.getFullYear()} – ${m(b)} de ${b.getFullYear()}`;
}

const horaCorta = (d) => {
  const h = d.getHours();
  return `${h % 12 || 12} ${h < 12 ? 'a.m.' : 'p.m.'}`;
};

function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'izq' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}

// Lista de programas con casilla de color (como "Mis calendarios" de Google).
function FiltroProgramas({ programas, ocultos, setOcultos }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const visibles = programas.length - programas.filter((p) => ocultos.has(p)).length;
  const alternar = (p) => setOcultos((s) => {
    const n = new Set(s);
    n.has(p) ? n.delete(p) : n.add(p);
    return n;
  });

  return (
    <div className="gc-prog" ref={ref}>
      <button type="button" className="gc-pill" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        Programas <span className="gc-cuenta">{visibles}/{programas.length}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {abierto && (
        <div className="gc-prog-pop">
          <div className="gc-prog-acc">
            <button type="button" className="sg-link" onClick={() => setOcultos(new Set())}>Mostrar todos</button>
            <button type="button" className="sg-link" onClick={() => setOcultos(new Set(programas))}>Ocultar todos</button>
          </div>
          {programas.map((p) => {
            const on = !ocultos.has(p);
            const color = colorPrograma(p);
            return (
              <label key={p} className="gc-check">
                <input type="checkbox" checked={on} onChange={() => alternar(p)} />
                <span className="gc-caja" style={{ background: on ? color : '#fff', borderColor: color }}>
                  {on && <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>}
                </span>
                <span className="gc-check-txt">{p}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Calendario semanal: clases del sistema (recurrentes) + eventos externos de Google Calendar.
export default function CalendarPanel({ clases, salonesPorId, eventosGcal, cargarGcal, momento, setMomento,
  salonSel, onClaseClick, onEventoClick, programas, ocultos, setOcultos }) {
  const ref = useRef(null);
  const [vista, setVista] = useState(null);
  const api = () => ref.current?.getApi();

  // Si el instante consultado cae fuera de lo visible (p. ej. se eligió en el panel), ir a esa fecha.
  useEffect(() => {
    const cal = api();
    if (cal && (momento < cal.view.activeStart || momento >= cal.view.activeEnd)) cal.gotoDate(momento);
  }, [momento]);

  const eventos = useMemo(() => {
    const deClases = clases
      .filter((c) => !ocultos.has(c.programa))
      .map((c) => {
        const s = salonesPorId[c.salon_id];
        const color = colorPrograma(c.programa);
        return {
          id: `c${c.id}`,
          title: tituloClase(c),
          daysOfWeek: [c.dia],
          startTime: hm(c.hora_inicio),
          endTime: hm(c.hora_fin),
          ...(c.fecha_inicio && { startRecur: c.fecha_inicio }),
          ...(c.fecha_fin && { endRecur: sumarDias(c.fecha_fin, 1) }),
          backgroundColor: color,
          borderColor: color,
          classNames: [salonSel && c.salon_id !== salonSel ? 'ev-atenuado' : '', !c.salon_id ? 'ev-sin-salon' : ''],
          extendedProps: { tipo: 'clase', clase: c, lugar: s ? s.nombre : 'Sin salón' },
        };
      });
    const deGcal = eventosGcal.map((e) => ({
      id: `g${e.id}`,
      title: e.titulo,
      start: e.inicio, end: e.fin, allDay: e.todoElDia,
      classNames: ['ev-gcal', salonSel && e.salon_id !== salonSel ? 'ev-atenuado' : ''],
      extendedProps: { tipo: 'gcal', evento: e, lugar: e.ubicacion },
    }));
    // Marca del instante consultado (30 min).
    const marca = {
      id: 'momento', start: momento, end: new Date(momento.getTime() + 30 * 60000),
      display: 'background', classNames: ['ev-momento'],
    };
    return [...deClases, ...deGcal, marca];
  }, [clases, salonesPorId, eventosGcal, momento, salonSel, ocultos]);

  const hoyISO = fechaISO(new Date());
  const selISO = fechaISO(momento);

  return (
    <div className="gc">
      <div className="gc-barra">
        <button type="button" className="gc-pill" onClick={() => { const d = new Date(); setMomento(d); api()?.today(); }}>Hoy</button>
        <div className="gc-nav">
          <button type="button" className="gc-redondo" onClick={() => api()?.prev()} aria-label="Anterior"><Chevron dir="izq" /></button>
          <button type="button" className="gc-redondo" onClick={() => api()?.next()} aria-label="Siguiente"><Chevron dir="der" /></button>
        </div>
        <h2 className="gc-titulo">{tituloVista(vista)}</h2>
        <select className="gc-vista" value={vista?.type || 'timeGridDay'} onChange={(e) => api()?.changeView(e.target.value)} aria-label="Vista">
          {VISTAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div className="gc-barra2">
        <FiltroProgramas programas={programas} ocultos={ocultos} setOcultos={setOcultos} />
        {eventosGcal.length > 0 && <span className="gc-leyenda"><i className="gc-dot-gcal" />Google Calendar</span>}
      </div>

      <div className="gc-cal">
        <FullCalendar
          ref={ref}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          locale={esLocale}
          initialView="timeGridDay"
          headerToolbar={false}
          height="100%"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00"
          scrollTime="07:00:00"
          nowIndicator
          allDaySlot={eventosGcal.some((e) => e.todoElDia)}
          expandRows
          slotEventOverlap={false}
          dayMaxEventRows={3}
          views={{ timeGridDay: { eventMaxStack: 8 }, timeGridWeek: { eventMaxStack: 2 } }}
          events={eventos}
          datesSet={(info) => {
            // El objeto view es mutable: se copia para que React note el cambio de rango.
            const v = info.view;
            setVista({ type: v.type, currentStart: v.currentStart, currentEnd: v.currentEnd });
            cargarGcal(info.start, info.end);
          }}
          slotLabelContent={(arg) => horaCorta(arg.date)}
          dayHeaderContent={(arg) => {
            if (arg.view.type === 'dayGridMonth') return <span className="gc-dow">{DOW[arg.date.getDay()]}</span>;
            const iso = fechaISO(arg.date);
            return (
              <div className="gc-dia">
                <span className={`gc-dow ${iso === hoyISO ? 'hoy' : ''}`}>{DOW[arg.date.getDay()]}</span>
                <button type="button" className={`gc-num ${iso === hoyISO ? 'hoy' : ''} ${iso === selISO ? 'sel' : ''}`}
                  title="Ver el día" onClick={() => api()?.changeView('timeGridDay', arg.date)}>
                  {arg.date.getDate()}
                </button>
              </div>
            );
          }}
          dayCellContent={(arg) => (arg.view.type === 'dayGridMonth'
            ? <span className={`gc-num-mes ${fechaISO(arg.date) === hoyISO ? 'hoy' : ''}`}>{arg.date.getDate()}</span>
            : null)}
          eventContent={(arg) => {
            if (arg.event.display === 'background') return null;
            const { lugar } = arg.event.extendedProps;
            if (arg.view.type === 'dayGridMonth') {
              return (
                <div className="gc-ev-mes">
                  <i style={{ background: arg.event.backgroundColor || '#039be5' }} />
                  {!arg.event.allDay && <span>{arg.timeText}</span>}
                  <b>{arg.event.title}</b>
                </div>
              );
            }
            return (
              <div className="gc-ev">
                <b>{arg.event.title}</b>
                <span>{arg.timeText}{lugar ? `, ${lugar}` : ''}</span>
              </div>
            );
          }}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: false, hour12: false }}
          dateClick={(info) => {
            if (info.allDay) {
              const d = new Date(info.date);
              d.setHours(momento.getHours(), momento.getMinutes());
              setMomento(d);
            } else setMomento(info.date);
          }}
          eventClick={(info) => {
            const { tipo, clase, evento } = info.event.extendedProps;
            if (tipo === 'clase') onClaseClick(clase, info.event.start);
            if (tipo === 'gcal') onEventoClick(evento);
          }}
          eventDidMount={(info) => {
            const { tipo, clase, lugar } = info.event.extendedProps;
            if (tipo === 'clase') info.el.title = [clase.materia, clase.programa, clase.profesor, lugar].filter(Boolean).join('\n');
          }}
        />
      </div>
    </div>
  );
}
