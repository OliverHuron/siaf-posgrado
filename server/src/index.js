import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { query } from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import salonesRoutes from './routes/salones.js';
import clasesRoutes from './routes/clases.js';
import gcalRoutes from './routes/gcal.js';

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en .env');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'OK', db: 'ok', time: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'ERROR', db: e.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/salones', requireAuth, salonesRoutes);
app.use('/api/clases', requireAuth, clasesRoutes);
app.use('/api/gcal', requireAuth, gcalRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = Number(process.env.PORT || 5005);
app.listen(PORT, () => console.log(`siaf-posgrado escuchando en :${PORT}`));
