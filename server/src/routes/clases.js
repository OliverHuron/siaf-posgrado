import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAdmin, ah } from '../middleware/auth.js';
import { buscarConflictos } from '../lib/conflictos.js';
import { procesarFilas } from '../lib/importador.js';
import { sincronizarClase, borrarEvento, sincronizarTodo, enSegundoPlano, gcalHabilitado } from '../lib/gcal.js';

const r = Router();

const CAMPOS = ['programa', 'materia', 'tipo', 'profesor', 'fecha_inicio', 'fecha_fin', 'dia',
  'hora_inicio', 'hora_fin', 'salon_id', 'alumnos', 'notas'];

const vacioANull = v => (v === '' || v === undefined ? null : v);

function validar(c) {
  if (!c.programa || !String(c.programa).trim()) return 'El programa es obligatorio';
  if (!['semestral', 'trimestral', 'otro'].includes(c.tipo)) return 'Tipo de curso inválido';
  if (!Number.isInteger(Number(c.dia)) || c.dia < 0 || c.dia > 6) return 'Día inválido';
  const hora = /^\d{2}:\d{2}(:\d{2})?$/;
  if (!hora.test(c.hora_inicio || '') || !hora.test(c.hora_fin || '')) return 'Horas inválidas';
  if (c.hora_fin.slice(0, 5) <= c.hora_inicio.slice(0, 5)) return 'La hora de fin debe ser posterior a la de inicio';
  if (c.fecha_inicio && c.fecha_fin && c.fecha_fin < c.fecha_inicio) return 'La fecha final es anterior a la de inicio';
  if (c.alumnos != null && (!Number.isInteger(Number(c.alumnos)) || c.alumnos < 0)) return 'Alumnos debe ser un entero positivo';
  return null;
}

function limpiar(body, base = {}) {
  const c = { tipo: 'semestral', ...base };
  for (const k of CAMPOS) if (k in body) c[k] = vacioANull(body[k]);
  for (const k of ['dia', 'salon_id', 'alumnos']) if (c[k] !== null && c[k] !== undefined) c[k] = Number(c[k]);
  return c;
}

async function guardar(req, res, existente) {
  const c = limpiar(req.body || {}, existente);
  const err = validar(c);
  if (err) return res.status(400).json({ error: err });
  if (c.salon_id) {
    const { rows } = await query('SELECT fuera_servicio, nombre FROM salones WHERE id = $1', [c.salon_id]);
    if (!rows[0]) return res.status(400).json({ error: 'El salón no existe' });
    if (rows[0].fuera_servicio && !req.body.forzar) {
      return res.status(409).json({ error: `${rows[0].nombre} está fuera de servicio`, conflictos: [] });
    }
  }
  const conflictos = await buscarConflictos(c, existente?.id ?? null);
  if (conflictos.length && !req.body.forzar) {
    return res.status(409).json({ error: 'El salón ya está ocupado en ese horario', conflictos });
  }
  const vals = CAMPOS.map(k => c[k] ?? null);
  const { rows } = existente
    ? await query(`UPDATE clases SET ${CAMPOS.map((k, i) => `${k} = $${i + 1}`).join(', ')}, actualizado_en = now()
                    WHERE id = $${CAMPOS.length + 1} RETURNING *`, [...vals, existente.id])
    : await query(`INSERT INTO clases (${CAMPOS.join(', ')}) VALUES (${CAMPOS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, vals);
  enSegundoPlano(sincronizarClase(rows[0]), `clase ${rows[0].id}`);
  res.status(existente ? 200 : 201).json(rows[0]);
}

r.get('/', ah(async (req, res) => {
  const { rows } = await query('SELECT * FROM clases ORDER BY dia, hora_inicio, programa');
  res.json(rows);
}));

r.post('/', requireAdmin, ah((req, res) => guardar(req, res, null)));

r.put('/:id', requireAdmin, ah(async (req, res) => {
  const { rows } = await query('SELECT * FROM clases WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Clase no encontrada' });
  // Normaliza fechas/horas del registro existente para que valide igual que la entrada.
  const e = { ...rows[0], hora_inicio: rows[0].hora_inicio.slice(0, 5), hora_fin: rows[0].hora_fin.slice(0, 5) };
  return guardar(req, res, e);
}));

r.delete('/:id', requireAdmin, ah(async (req, res) => {
  const { rows } = await query('DELETE FROM clases WHERE id = $1 RETURNING gcal_event_id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Clase no encontrada' });
  enSegundoPlano(borrarEvento(rows[0].gcal_event_id), `borrar clase ${req.params.id}`);
  res.json({ ok: true });
}));

// Importación desde el Excel de horarios (las filas llegan ya leídas por el cliente).
r.post('/importar', requireAdmin, ah(async (req, res) => {
  const { filas, anioBase, modo } = req.body || {};
  if (!Array.isArray(filas) || !filas.length) return res.status(400).json({ error: 'No hay filas para importar' });
  const anio = Number(anioBase) || new Date().getFullYear();
  const { rows: salones } = await query('SELECT id, codigo, nombre FROM salones');
  const { clases, fueraServicio, avisos } = procesarFilas(filas, salones, anio);

  const db = await pool.connect();
  let borrados = [];
  try {
    await db.query('BEGIN');
    if (modo === 'reemplazar') {
      const del = await db.query('DELETE FROM clases RETURNING gcal_event_id');
      borrados = del.rows.map(x => x.gcal_event_id).filter(Boolean);
    }
    for (const c of clases) {
      const cols = Object.keys(c);
      await db.query(`INSERT INTO clases (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
        cols.map(k => c[k]));
    }
    for (const f of fueraServicio) {
      await db.query('UPDATE salones SET fuera_servicio = TRUE, motivo = $1, actualizado_en = now() WHERE id = $2', [f.motivo, f.salon_id]);
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }

  if (gcalHabilitado()) {
    enSegundoPlano((async () => {
      for (const id of borrados) await borrarEvento(id);
      await sincronizarTodo();
    })(), 'importación');
  }
  res.json({ insertadas: clases.length, fueraServicio: fueraServicio.length, avisos });
}));

export default r;
