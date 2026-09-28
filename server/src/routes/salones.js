import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, ah } from '../middleware/auth.js';

const r = Router();

r.get('/', ah(async (req, res) => {
  const { rows } = await query('SELECT * FROM salones ORDER BY planta, nombre');
  res.json(rows);
}));

// Solo campos operativos; la geometría viene del plano y no se edita desde la UI.
const EDITABLES = ['nombre', 'tipo', 'asignable', 'mesas', 'fuera_servicio', 'motivo', 'notas'];

r.patch('/:id', requireAdmin, ah(async (req, res) => {
  const campos = EDITABLES.filter(k => k in (req.body || {}));
  if (!campos.length) return res.status(400).json({ error: 'Nada que actualizar' });
  if ('mesas' in req.body) {
    const m = Number(req.body.mesas);
    if (!Number.isInteger(m) || m < 0 || m > 60) return res.status(400).json({ error: 'Mesas debe ser un entero entre 0 y 60' });
  }
  const sets = campos.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const { rows } = await query(
    `UPDATE salones SET ${sets}, actualizado_en = now() WHERE id = $${campos.length + 1} RETURNING *`,
    [...campos.map(k => req.body[k] === '' ? null : req.body[k]), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Salón no encontrado' });
  res.json(rows[0]);
}));

export default r;
