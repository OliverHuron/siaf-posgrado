// Aplica en orden los archivos de migrations/ que aún no estén en la tabla _migraciones.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const db = await pool.connect();
try {
  await db.query(`CREATE TABLE IF NOT EXISTS _migraciones (
    nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows } = await db.query('SELECT nombre FROM _migraciones');
  const hechas = new Set(rows.map(r => r.nombre));
  const pendientes = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !hechas.has(f)).sort();
  for (const f of pendientes) {
    await db.query('BEGIN');
    try {
      await db.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await db.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [f]);
      await db.query('COMMIT');
      console.log(`✔ ${f}`);
    } catch (e) {
      await db.query('ROLLBACK');
      console.error(`✘ ${f}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!pendientes.length) console.log('Sin migraciones pendientes');
} finally {
  db.release();
  await pool.end();
}
