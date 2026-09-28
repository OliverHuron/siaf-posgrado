# SIAF Posgrado — Salones

Control de salones del edificio de Posgrado (FCCA · UMSNH): mapa interactivo de las tres
plantas, horario de clases con detección de choques, mobiliario (mesas de 2 sillas) y
sincronización con Google Calendar.

- `server/` — Express + PostgreSQL (puerto 5005).
- `client/` — React + Vite + FullCalendar; el mapa es SVG propio con zoom/arrastre.
- Producción: ver [DEPLOYMENT.md](DEPLOYMENT.md).

## Desarrollo local

```bash
# 1. Base de datos
createdb posgrado_db

# 2. Backend
cd server
cp .env.example .env        # ajustar DB_USER / DB_PASSWORD / JWT_SECRET
npm install
npm run migrate
npm run seed                # usuarios admin / consulta (contraseña 123456), salones y horario
npm run dev

# 3. Frontend (otra terminal)
cd client
npm install
npm run dev                 # http://localhost:5173 (proxy /api → :5005)
```
