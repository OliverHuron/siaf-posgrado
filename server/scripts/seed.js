// Siembra usuarios, salones (del plano) y el horario inicial. Idempotente:
// - usuarios y salones se insertan solo si no existen (ON CONFLICT DO NOTHING);
// - el horario se carga solo si la tabla clases está vacía.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { procesarFilas } from '../src/lib/importador.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed');
const leer = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const db = await pool.connect();
try {
  await db.query('BEGIN');

  const hash = await bcrypt.hash(process.env.SEED_PASSWORD || '123456', 10);
  for (const [usuario, nombre, rol] of [
    ['admin', 'Administrador Posgrado', 'admin'],
    ['consulta', 'Consulta Posgrado', 'consulta'],
  ]) {
    await db.query(
      `INSERT INTO usuarios (usuario, nombre, password_hash, rol) VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario) DO NOTHING`, [usuario, nombre, hash, rol]);
  }

  for (const s of leer('salones.json')) {
    await db.query(
      `INSERT INTO salones (codigo, nombre, planta, tipo, asignable, mesas, x, y, w, h)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (codigo) DO NOTHING`,
      [s.codigo, s.nombre, s.planta, s.tipo, s.asignable, s.mesas, s.x, s.y, s.w, s.h]);
  }

  const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM clases');
  if (n === 0) {
    const horario = leer('horario-2026B.json');
    const filas = horario.grupos.flatMap(g => g.filas.map(
      ([materia, profesor, dias, hora, salon, inicio, fin]) => ({
        posgrado: g.posgrado, tipo: g.tipo, piso: g.piso,
        materia, profesor, dias, hora,
        salon: salon ?? g.salon, inicio: inicio ?? g.inicio, fin: fin ?? g.fin,
      })));
    const { rows: salones } = await db.query('SELECT id, codigo, nombre FROM salones');
    const { clases, fueraServicio, avisos } = procesarFilas(filas, salones, horario.anioBase);
    for (const c of clases) {
      const cols = Object.keys(c);
      await db.query(`INSERT INTO clases (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
        cols.map(k => c[k]));
    }
    for (const f of fueraServicio) {
      await db.query('UPDATE salones SET fuera_servicio = TRUE, motivo = $1 WHERE id = $2', [f.motivo, f.salon_id]);
    }
    console.log(`Horario: ${clases.length} clases, ${fueraServicio.length} salón(es) fuera de servicio`);
    avisos.forEach(a => console.log('  aviso:', a));
  } else {
    console.log(`Horario: ya hay ${n} clases, no se tocó`);
  }

  await db.query('COMMIT');
  console.log('Seed completo');
} catch (e) {
  await db.query('ROLLBACK');
  console.error('Seed falló:', e.message);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
