import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { requireAuth, ah } from '../middleware/auth.js';

const r = Router();

r.post('/login', ah(async (req, res) => {
  const { usuario, password } = req.body || {};
  const { rows } = await query('SELECT * FROM usuarios WHERE usuario = $1 AND activo', [String(usuario || '').trim().toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const user = { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
  res.json({ token, user });
}));

r.get('/me', requireAuth, (req, res) => {
  const { id, usuario, nombre, rol } = req.user;
  res.json({ id, usuario, nombre, rol });
});

r.put('/password', requireAuth, ah(async (req, res) => {
  const { actual, nueva } = req.body || {};
  if (!nueva || String(nueva).length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  const { rows } = await query('SELECT password_hash FROM usuarios WHERE id = $1', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(String(actual || ''), rows[0].password_hash))) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }
  await query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(String(nueva), 10), req.user.id]);
  res.json({ ok: true });
}));

export default r;
