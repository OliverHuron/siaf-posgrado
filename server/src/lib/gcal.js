// Integración con Google Calendar mediante cuenta de servicio.
// - Cada clase se publica como evento semanal recurrente (RRULE) en GCAL_CALENDAR_ID.
// - Los eventos creados a mano en ese calendario se leen y, si su "ubicación" menciona
//   un salón (código o nombre), cuentan como ocupación de ese salón.
import crypto from 'node:crypto';
import { calendar as gcalendar, auth as gauth } from '@googleapis/calendar';
import { query } from '../db.js';
import { norm } from './importador.js';

const CAL_ID = process.env.GCAL_CALENDAR_ID;
const TZ = process.env.TZ_CLASES || 'America/Mexico_City';
const DIAS_RRULE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const gcalHabilitado = () => Boolean(CAL_ID && process.env.GCAL_KEY_FILE);

let cliente;
function cal() {
  if (!cliente) {
    const auth = new gauth.GoogleAuth({
      keyFile: process.env.GCAL_KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    cliente = gcalendar({ version: 'v3', auth });
  }
  return cliente;
}

const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Primera fecha >= desde que cae en el día de la semana `dia`.
function primeraOcurrencia(desde, dia) {
  const d = new Date(`${desde}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((dia - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

function eventoDeClase(c, salon) {
  const fecha = primeraOcurrencia(c.fecha_inicio || hoyISO(), c.dia);
  const hi = c.hora_inicio.slice(0, 5), hf = c.hora_fin.slice(0, 5);
  // UNTIL va en UTC: el fin del último día en México (UTC-6) es 05:59:59Z del día siguiente.
  const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${DIAS_RRULE[c.dia]}` +
    (c.fecha_fin ? `;UNTIL=${sumarDias(c.fecha_fin, 1).replace(/-/g, '')}T055959Z` : '');
  return {
    summary: [c.materia, c.programa].filter(Boolean).join(' · '),
    location: salon ? `${salon.nombre} (${salon.codigo})` : 'Sin salón asignado',
    description: [c.profesor && `Profesor(a): ${c.profesor}`, `Programa: ${c.programa}`,
      c.alumnos != null && `Alumnos: ${c.alumnos}`, c.notas].filter(Boolean).join('\n'),
    start: { dateTime: `${fecha}T${hi}:00`, timeZone: TZ },
    end: { dateTime: `${fecha}T${hf}:00`, timeZone: TZ },
    recurrence: [rrule],
    extendedProperties: { private: { siafClaseId: String(c.id) } },
  };
}

async function salonDe(c) {
  if (!c.salon_id) return null;
  const { rows } = await query('SELECT codigo, nombre FROM salones WHERE id = $1', [c.salon_id]);
  return rows[0] || null;
}

// Crea o actualiza el evento de una clase. Omite la llamada si nada cambió.
export async function sincronizarClase(c) {
  if (!gcalHabilitado()) return;
  const body = eventoDeClase(c, await salonDe(c));
  const hash = crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex');
  if (c.gcal_event_id && c.gcal_hash === hash) return;
  let eventId = c.gcal_event_id;
  if (eventId) {
    try {
      await cal().events.update({ calendarId: CAL_ID, eventId, requestBody: body });
    } catch (e) {
      if (e.code !== 404 && e.code !== 410) throw e;
      eventId = null;
    }
  }
  if (!eventId) {
    const r = await cal().events.insert({ calendarId: CAL_ID, requestBody: body });
    eventId = r.data.id;
  }
  await query('UPDATE clases SET gcal_event_id = $1, gcal_hash = $2 WHERE id = $3', [eventId, hash, c.id]);
}

export async function borrarEvento(eventId) {
  if (!gcalHabilitado() || !eventId) return;
  try {
    await cal().events.delete({ calendarId: CAL_ID, eventId });
  } catch (e) {
    if (e.code !== 404 && e.code !== 410) throw e;
  }
}

// Para llamar sin bloquear la respuesta HTTP.
export function enSegundoPlano(promesa, contexto) {
  promesa.catch(e => console.error(`[gcal] ${contexto}:`, e.message));
}

export async function sincronizarTodo() {
  const { rows } = await query('SELECT * FROM clases ORDER BY id');
  let ok = 0; const errores = [];
  for (const c of rows) {
    try { await sincronizarClase(c); ok++; } catch (e) { errores.push(`Clase ${c.id}: ${e.message}`); }
  }
  return { total: rows.length, ok, errores };
}

// Eventos del calendario que NO son clases del sistema (reservas, juntas, exámenes…).
export async function listarEventosExternos(timeMin, timeMax, salones) {
  if (!gcalHabilitado()) return [];
  const items = [];
  let pageToken;
  do {
    const r = await cal().events.list({
      calendarId: CAL_ID, timeMin, timeMax, singleEvents: true, orderBy: 'startTime',
      maxResults: 2500, pageToken,
    });
    items.push(...(r.data.items || []));
    pageToken = r.data.nextPageToken;
  } while (pageToken);

  return items
    .filter(e => e.status !== 'cancelled' && !e.extendedProperties?.private?.siafClaseId)
    .map(e => ({
      id: e.id,
      titulo: e.summary || '(sin título)',
      ubicacion: e.location || null,
      descripcion: e.description || null,
      inicio: e.start.dateTime || e.start.date,
      fin: e.end.dateTime || e.end.date,
      todoElDia: !e.start.dateTime,
      enlace: e.htmlLink,
      salon_id: salonDeUbicacion(e.location, salones),
    }));
}

function salonDeUbicacion(ubicacion, salones) {
  const u = norm(ubicacion);
  if (!u) return null;
  const porCodigo = salones.find(s => new RegExp(`\\b${s.codigo}\\b`, 'i').test(u));
  if (porCodigo) return porCodigo.id;
  // Nombres más largos primero para que "AULA 10" no se confunda con "AULA 1".
  const porNombre = [...salones].sort((a, b) => b.nombre.length - a.nombre.length)
    .find(s => new RegExp(`(^|[^A-Z0-9])${norm(s.nombre)}($|[^A-Z0-9])`).test(u));
  return porNombre?.id ?? null;
}
