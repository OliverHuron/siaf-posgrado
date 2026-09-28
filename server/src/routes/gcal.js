import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, ah } from '../middleware/auth.js';
import { gcalHabilitado, listarEventosExternos, sincronizarTodo } from '../lib/gcal.js';

const r = Router();

r.get('/estado', (req, res) => {
  res.json({ habilitado: gcalHabilitado(), calendarId: gcalHabilitado() ? process.env.GCAL_CALENDAR_ID : null });
});

r.get('/eventos', ah(async (req, res) => {
  if (!gcalHabilitado()) return res.json([]);
  const { start, end } = req.query;
  const inicio = new Date(start), fin = new Date(end);
  if (isNaN(inicio) || isNaN(fin) || fin <= inicio || fin - inicio > 1000 * 60 * 60 * 24 * 62) {
    return res.status(400).json({ error: 'Rango de fechas inválido (máximo 62 días)' });
  }
  const { rows: salones } = await query('SELECT id, codigo, nombre FROM salones');
  res.json(await listarEventosExternos(inicio.toISOString(), fin.toISOString(), salones));
}));

r.post('/sincronizar', requireAdmin, ah(async (req, res) => {
  if (!gcalHabilitado()) return res.status(400).json({ error: 'Google Calendar no está configurado en el servidor' });
  res.json(await sincronizarTodo());
}));

export default r;
