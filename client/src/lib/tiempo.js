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

// Color por programa. Tonos bien separados entre sí (la paleta de Google tenía tres verdes casi iguales);
// en orden alterno para que programas contiguos alfabéticamente (p. ej. variantes de Maestría en Fiscal) contrasten.
const PALETA = [
  '#1e88e5', // azul
  '#e53935', // rojo
  '#43a047', // verde
  '#fb8c00', // naranja
  '#8e24aa', // morado
  '#00acc1', // cian
  '#795548', // café
  '#d81b60', // rosa
  '#3949ab', // índigo
  '#9e9d24', // oliva
  '#546e7a', // gris azulado
  '#f4b400', // amarillo
];
const asignados = new Map();

// Reparte la paleta en orden sobre la lista (ordenada) de programas, para que no se repitan
// mientras haya colores suficientes. Se llama cada vez que cambia la lista de programas.
export function asignarColores(programas) {
  asignados.clear();
  programas.forEach((p, i) => asignados.set(p, PALETA[i % PALETA.length]));
}

export function colorPrograma(p) {
  if (asignados.has(p)) return asignados.get(p);
  let h = 0; // programa aún no registrado (p. ej. recién escrito en el formulario)
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
