export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const PLANTAS = [
  { id: 'baja', nombre: 'Planta baja' },
  { id: 'primera', nombre: '1ª planta' },
  { id: 'segunda', nombre: '2ª planta' },
];

const pad = n => String(n).padStart(2, '0');
export const fechaISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const horaHM = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const hm = t => (t ? t.slice(0, 5) : '');

export function sumarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}

// ¿La clase está vigente en esa fecha (y ese día de la semana)?
export function claseEnFecha(c, d) {
  if (c.dia !== d.getDay()) return false;
  const f = fechaISO(d);
  return (!c.fecha_inicio || c.fecha_inicio <= f) && (!c.fecha_fin || c.fecha_fin >= f);
}

// ¿La clase se está impartiendo en el instante d?
export function claseEnMomento(c, d) {
  if (!claseEnFecha(c, d)) return false;
  const h = horaHM(d);
  return hm(c.hora_inicio) <= h && h < hm(c.hora_fin);
}

export function eventoEnMomento(e, d) {
  if (e.todoElDia) return false;
  return new Date(e.inicio) <= d && d < new Date(e.fin);
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtFecha = d => cap(d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
export const fmtFechaCorta = iso => iso
  ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

// Color estable por programa: los colores de evento de Google Calendar
// (Arándano, Pavo real, Salvia, Uva, Mandarina, Albahaca, Lavanda, Flamenco, Plátano, Tomate, Verde azulado).
const PALETA = ['#3f51b5', '#039be5', '#33b679', '#8e24aa', '#f4511e', '#0b8043', '#7986cb', '#e67c73', '#f6bf26', '#d50000', '#009688'];
export function colorPrograma(p) {
  let h = 0;
  for (const ch of String(p)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

export const tituloClase = c => c.materia || c.programa;

// Para búsquedas: sin acentos ni mayúsculas.
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Misma regla que el servidor (lib/conflictos.js): mismo día, horas y periodos traslapados.
export function seEnciman(a, b) {
  return a.dia === b.dia
    && hm(a.hora_inicio) < hm(b.hora_fin) && hm(b.hora_inicio) < hm(a.hora_fin)
    && (a.fecha_inicio || '0000') <= (b.fecha_fin || '9999')
    && (b.fecha_inicio || '0000') <= (a.fecha_fin || '9999');
}
