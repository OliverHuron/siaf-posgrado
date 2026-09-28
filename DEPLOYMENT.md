# SIAF Posgrado (Salones) — Runbook de Despliegue en Producción

Servidor físico compartido con `siaf-nominas`, `siaf-solicitudes`, `siaf-fichatecnica` y
`siaf-justificantes`. Arquitectura:

```
Internet → Cloudflare Tunnel → cloudflared (systemd) → nginx :80
                                                          ├─ /var/www/siaf-posgrado/client/dist  (estático, SPA)
                                                          └─ /api → localhost:5005 → PM2 → Express → PostgreSQL (posgrado_db)
                                                                                              └─ Google Calendar API (cuenta de servicio)
```

Despliegue automático: `push` a `main` → GitHub Actions → runner self-hosted en el servidor
(label `siaf`, el mismo de los otros proyectos SIAF) → `rsync` + build + migraciones +
`pm2 restart`. No hay SSH manual en el flujo normal; el setup inicial sí, paso por paso, abajo.

Todos los comandos van por **SSH al servidor**, como usuario `oliver`, salvo que se indique
otra cosa. Ejecuta los pasos en orden.

> El hostname usado aquí es `posgrado.siafsystem.online`. Si será otro, cámbialo en los
> pasos 5, 8, 9 y 12.

---

## Paso 1 — Verificar dependencias del sistema

Si ya desplegaste otro proyecto SIAF en este servidor, esto ya está instalado:

```bash
node -v          # esperado: v20+
psql --version   # esperado: 16
nginx -v
pm2 -v
cloudflared --version
```

---

## Paso 2 — Crear la carpeta de despliegue con permisos correctos

```bash
sudo mkdir -p /var/www/siaf-posgrado
sudo chown -R oliver:oliver /var/www/siaf-posgrado
```

```bash
ls -ld /var/www/siaf-posgrado   # debe mostrar "oliver oliver"
```

---

## Paso 3 — Permisos `sudo` sin contraseña (si no se agregaron ya para otro proyecto)

```bash
sudo visudo -f /etc/sudoers.d/siaf-posgrado
```

```
oliver ALL=(ALL) NOPASSWD: /bin/chown -R oliver\:oliver /var/www/siaf-posgrado
oliver ALL=(postgres) NOPASSWD: /usr/bin/psql
```

```bash
sudo visudo -c
```

---

## Paso 4 — Crear la base de datos y el usuario de PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE posgrado_db;
CREATE USER posgrado_admin WITH ENCRYPTED PASSWORD 'CAMBIA_ESTA_CONTRASEÑA';
GRANT ALL PRIVILEGES ON DATABASE posgrado_db TO posgrado_admin;
\c posgrado_db
GRANT ALL ON SCHEMA public TO posgrado_admin;
\q
```

- No hace falta correr `001_initial.sql` a mano: el workflow ejecuta `npm run migrate` en
  cada deploy (Paso 10). El sembrado inicial (`npm run seed`) se corre una sola vez, a mano
  (Paso 11).

---

## Paso 5 — Crear el archivo `.env` de producción (backup fuera del repo)

```bash
sudo nano /var/www/.env.siaf-posgrado
```

- Contenido (ajustar contraseña y secreto; `JWT_SECRET` debe ser un string largo y
  aleatorio, distinto del de otros proyectos SIAF — p. ej. `openssl rand -base64 48`):

```
NODE_ENV=production
PORT=5005
CLIENT_URL=https://posgrado.siafsystem.online

DB_HOST=localhost
DB_PORT=5432
DB_USER=posgrado_admin
DB_PASSWORD=CAMBIA_ESTA_CONTRASEÑA
DB_NAME=posgrado_db

JWT_SECRET=GENERA_UN_STRING_LARGO_Y_ALEATORIO
JWT_EXPIRE=7d

TZ_CLASES=America/Mexico_City

# Google Calendar (Paso 6). Vacíos = integración desactivada; el sistema funciona igual.
GCAL_CALENDAR_ID=
GCAL_KEY_FILE=/var/www/.gcal-siaf-posgrado.json

SEED_PASSWORD=123456
```

```bash
sudo chown oliver:oliver /var/www/.env.siaf-posgrado
sudo chmod 600 /var/www/.env.siaf-posgrado
```

---

## Paso 6 — Google Calendar con cuenta de servicio (opcional)

El sistema publica cada clase como evento semanal recurrente en un calendario de Google, y
lee de ese mismo calendario los eventos creados a mano (juntas, exámenes, reservas). Si la
**ubicación** de un evento menciona un salón (`AULA 3`, `CÓMPUTO B` o su código `6111`), el
salón aparece ocupado en el mapa durante ese evento.

1. En [Google Cloud Console](https://console.cloud.google.com/): crear (o reutilizar) un
   proyecto → **APIs y servicios → Biblioteca** → habilitar **Google Calendar API**.
2. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio** (sin roles).
   En la cuenta creada: **Claves → Agregar clave → JSON**. Se descarga un archivo `.json`.
3. En Google Calendar (con la cuenta institucional del posgrado): crear un calendario nuevo
   (p. ej. "Salones Posgrado") → **Configuración y uso compartido** →
   **Compartir con personas específicas** → agregar el correo de la cuenta de servicio
   (`…@….iam.gserviceaccount.com`) con permiso **Hacer cambios en eventos**.
4. En la misma página, sección **Integrar el calendario**, copiar el **ID del calendario**
   (`…@group.calendar.google.com`) y ponerlo en `GCAL_CALENDAR_ID` del `.env`.
5. Subir la llave al servidor, fuera del repo:

```bash
# desde tu máquina
scp llave-descargada.json oliver@<servidor>:/var/www/.gcal-siaf-posgrado.json
# en el servidor
chmod 600 /var/www/.gcal-siaf-posgrado.json
```

6. Después del primer deploy, entrar como `admin` y pulsar **Sincronizar** en la barra
   superior para publicar el horario completo en el calendario. A partir de ahí cada alta,
   cambio o baja de clase se refleja sola.

---

## Paso 7 — Runner de GitHub Actions (label `siaf`)

```bash
systemctl list-units --type=service | grep -i actions.runner
```

- Si ya existe un runner con label `siaf` (compartido entre proyectos SIAF), solo agrega
  este repo (`siaf-posgrado`) a los que atiende. Si no existe, sigue el procedimiento del
  runbook de `siaf-nominas` cambiando la URL del repo y el `--name` a `siaf-posgrado`.

---

## Paso 8 — Server block de nginx

```bash
sudo nano /etc/nginx/sites-available/siaf-posgrado
```

```nginx
server {
    listen 80;
    server_name posgrado.siafsystem.online;

    root /var/www/siaf-posgrado/client/dist;
    index index.html;

    # La importación del Excel de horarios viaja como JSON (límite del backend: 5 MB).
    client_max_body_size 6m;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/siaf-posgrado /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> `client/dist` aún no existe en este punto (se crea en el Paso 10) — es normal que nginx
> devuelva error hasta entonces.

---

## Paso 9 — Agregar el hostname al Cloudflare Tunnel existente

```bash
sudo nano /etc/cloudflared/config.yml
```

- Agregar la línea de `ingress` **antes** de `service: http_status:404`:

```yaml
ingress:
  # … hostnames existentes (staging, solicitudes, nominas, fichatecnica, justificantes) …
  - hostname: posgrado.siafsystem.online
    service: http://localhost:80
  - service: http_status:404
```

```bash
cloudflared tunnel route dns <nombre-o-id-del-tunnel> posgrado.siafsystem.online
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

---

## Paso 10 — Disparar el primer despliegue

Desde tu máquina local (no en el servidor):

```bash
git push origin main
```

- Dispara `.github/workflows/deploy.yml`: `rsync` → restaura `.env` → `npm ci` (server) →
  `npm run migrate` → `npm ci && npm run build` (client) → `pm2 start src/index.js --name
  siaf-posgrado` (o `pm2 restart` si ya existe) → `pm2 save` → verifica `/api/health`.
- Seguir el progreso en la pestaña **Actions** del repo `siaf-posgrado`.

---

## Paso 11 — Sembrar cuentas, salones y horario inicial (solo la primera vez)

```bash
cd /var/www/siaf-posgrado/server
npm run seed
```

- Crea 2 cuentas con la contraseña temporal de `SEED_PASSWORD` (`123456` por defecto) —
  deben cambiarla al primer ingreso (clic en su nombre, arriba a la derecha):

  | usuario | rol | puede |
  |---|---|---|
  | `admin` | admin | todo: clases, salones, mesas, importar Excel, sincronizar Calendar |
  | `consulta` | consulta | ver mapa, calendario y ocupación; simular alumnos |

- Siembra los 38 espacios de las tres plantas (geometría tomada de los planos) y el horario
  del periodo ago 2026 – ene 2027 transcrito de la captura (81 sesiones semanales). Los
  textos que venían cortados se corrigen reimportando el Excel original desde la app
  (**Importar Excel → Reemplazar todo el horario**).
- Es idempotente: si se corre otra vez, no duplica (el horario solo se carga si no hay clases).

---

## Paso 12 — Verificar que el despliegue funcionó

En el servidor:

```bash
pm2 list                                          # siaf-posgrado debe estar "online"
pm2 logs siaf-posgrado --lines 50
curl -s http://localhost:5005/api/health          # {"status":"OK", "db":"ok", ...}
```

Desde cualquier máquina:

```bash
curl -sI https://posgrado.siafsystem.online
curl -s  https://posgrado.siafsystem.online/api/health
```

---

## Paso 13 — Persistencia tras reinicio del servidor

Como `oliver` (si `pm2 startup` ya se configuró para otro proyecto SIAF, solo hace falta
`pm2 save`):

```bash
pm2 startup   # ejecutar el comando sudo que imprime, si aún no se hizo
pm2 save
cat ~/.pm2/dump.pm2 | grep siaf-posgrado
```

---

## Notas de operación

- **Migraciones**: agregar `server/migrations/00X_*.sql`; el runner las aplica en orden en
  el siguiente deploy y registra cada una en la tabla `_migraciones`.
- **`.env`**: cambios en producción se hacen en `/var/www/.env.siaf-posgrado` y se aplican
  con `pm2 restart siaf-posgrado --update-env`.
- **Nuevo periodo**: *Importar Excel* con el año base del periodo. Fechas tipo
  "24 de agosto": de junio a diciembre toman el año base; de enero a mayo, el siguiente.
  Filas cuyo POSGRADO diga "GOTERA", "NO SE USA" o "FUERA DE SERVICIO" marcan el salón como
  fuera de servicio en vez de crear una clase.
- **Planos**: la geometría de los salones (x, y, w, h) está en `server/seed/salones.json`
  y los dibujos en `client/src/plans/*.svg`, ambos generados del HTML de plantas. Mesas,
  estado y notas de cada salón sí se editan desde la UI.
- **Respaldo**: todo el estado vive en `posgrado_db` (`pg_dump posgrado_db`). No hay
  archivos subidos que respaldar.
