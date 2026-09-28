// Convierte filas "crudas" del Excel de horarios (o del seed) en clases normalizadas.
// Formato de fila: { posgrado, materia, tipo, inicio, fin, profesor, dias, hora, salon, piso }
// con los textos tal como vienen en la hoja ("24 de agosto", "Sábado", "7:00 - 9:00", "Computo C"…).

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

const pad = n => String(n).padStart(2, '0');

// Encabezados del Excel → llaves internas.
export function normalizarEncabezados(fila) {
  const out = {};
  for (const [k, v] of Object.entries(fila)) {
    const h = norm(k);
    const key =
      h.startsWith('POSGRADO') ? 'posgrado' :
      h.startsWith('MATERIA') ? 'materia' :
      h.startsWith('TIPO') ? 'tipo' :
      h.includes('INICIO') ? 'inicio' :
      h.includes('FINAL') || h.includes('FIN ') || h === 'FIN' ? 'fin' :
      h.startsWith('PROFESOR') || h.startsWith('DOCENTE') ? 'profesor' :
      h.startsWith('DIA') ? 'dias' :
      h.startsWith('HORA') || h.startsWith('HORARIO') ? 'hora' :
      h.startsWith('SALON') || h.startsWith('AULA') ? 'salon' :
      h.startsWith('PISO') || h.startsWith('PLANTA') ? 'piso' : null;
    if (key) out[key] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

// "24 de agosto" → '2026-08-24'. Periodo que arranca en `anioBase`: jun-dic = anioBase, ene-may = anioBase+1.
// También acepta '2026-08-24', '24/08/2026' y números de serie de Excel.
export function parseFecha(v, anioBase) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = norm(v).toLowerCase();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{1,2})\s*(?:de\s+)?([a-z]+)(?:\s+(?:de(?:l)?\s+)?(\d{4}))?$/);
  if (m) {
    const mes = MESES.findIndex(x => x.startsWith(m[2].slice(0, 3)));
    if (mes < 0) return null;
    const anio = m[3] ? Number(m[3]) : (mes >= 5 ? anioBase : anioBase + 1);
    return `${anio}-${pad(mes + 1)}-${pad(m[1])}`;
  }
  return null;
}

// "Lunes y Miércoles", "lunes, martes", "Sábado" → [1, 3] …
export function parseDias(v) {
  return norm(v).toLowerCase().split(/\s*(?:,|\/|;|\by\b|-)\s*/)
    .map(x => DIAS[x.trim()]).filter(x => x !== undefined);
}

// "7:00 - 9:00", "08:00-11:00", "7 a 9" → ['07:00', '09:00']
export function parseHora(v) {
  const m = String(v ?? '').match(/(\d{1,2})(?::(\d{2}))?\s*(?:-|–|a)\s*(\d{1,2})(?::(\d{2}))?/i);
  if (!m) return null;
  const hi = `${pad(m[1])}:${m[2] || '00'}`, hf = `${pad(m[3])}:${m[4] || '00'}`;
  return hi < hf ? [hi, hf] : null;
}

// Busca el salón: "3" + "PB" → AULA 3; "Computo C" → CÓMPUTO C; también por código (6101).
export function resolverSalon(texto, salones) {
  const t = norm(texto);
  if (!t) return null;
  const nombre = /^\d+$/.test(t) ? `AULA ${Number(t)}` : t;
  return salones.find(s => norm(s.codigo) === t)
    || salones.find(s => norm(s.nombre) === nombre)
    || salones.find(s => norm(s.nombre).replace(/\s/g, '') === nombre.replace(/\s/g, ''))
    || null;
}

const tipoCurso = v => {
  const t = norm(v);
  return t.startsWith('SEM') ? 'semestral' : t.startsWith('TRIM') ? 'trimestral' : t ? 'otro' : 'semestral';
};

// Devuelve { clases, fueraServicio: [{salon_id, motivo}], avisos: [texto] }
export function procesarFilas(filas, salones, anioBase) {
  const clases = [], fueraServicio = [], avisos = [];
  const vistos = new Set();
  filas.forEach((raw, i) => {
    const f = normalizarEncabezados(raw);
    const n = i + 1;
    const posgrado = String(f.posgrado ?? '').trim();
    const salon = resolverSalon(f.salon, salones);
    if (/GOTERA|NO SE USA|FUERA DE SERVICIO/.test(norm(posgrado))) {
      if (salon) fueraServicio.push({ salon_id: salon.id, motivo: posgrado });
      else avisos.push(`Fila ${n}: salón fuera de servicio "${f.salon}" no encontrado`);
      return;
    }
    if (!posgrado) return; // fila vacía o solo con salón
    const dias = parseDias(f.dias);
    const horas = parseHora(f.hora);
    if (!dias.length) { avisos.push(`Fila ${n} (${posgrado}): día no reconocido "${f.dias ?? ''}"`); return; }
    if (!horas) { avisos.push(`Fila ${n} (${posgrado}): hora no reconocida "${f.hora ?? ''}"`); return; }
    if (f.salon && !salon) avisos.push(`Fila ${n} (${posgrado}): salón "${f.salon}" no existe en el plano; queda sin asignar`);
    const inicio = parseFecha(f.inicio, anioBase), fin = parseFecha(f.fin, anioBase);
    for (const dia of dias) {
      const c = {
        programa: posgrado,
        materia: f.materia ? String(f.materia).trim() : null,
        tipo: tipoCurso(f.tipo),
        profesor: f.profesor ? String(f.profesor).trim() : null,
        fecha_inicio: inicio,
        fecha_fin: fin && inicio && fin < inicio ? null : fin,
        dia, hora_inicio: horas[0], hora_fin: horas[1],
        salon_id: salon?.id ?? null,
      };
      const clave = JSON.stringify(c);
      if (vistos.has(clave)) { avisos.push(`Fila ${n} (${posgrado}): duplicada, se omitió`); continue; }
      vistos.add(clave);
      clases.push(c);
    }
  });
  return { clases, fueraServicio, avisos };
}
