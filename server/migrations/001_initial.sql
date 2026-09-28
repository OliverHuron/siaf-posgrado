CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  usuario       TEXT UNIQUE NOT NULL,
  nombre        TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('admin', 'consulta')),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Geometría (x, y, w, h) en coordenadas del plano SVG de su planta.
CREATE TABLE IF NOT EXISTS salones (
  id             SERIAL PRIMARY KEY,
  codigo         TEXT UNIQUE NOT NULL,
  nombre         TEXT NOT NULL,
  planta         TEXT NOT NULL CHECK (planta IN ('baja', 'primera', 'segunda')),
  tipo           TEXT NOT NULL CHECK (tipo IN ('aula', 'computo', 'sala', 'cubiculo', 'otro')),
  asignable      BOOLEAN NOT NULL DEFAULT TRUE,
  mesas          INTEGER NOT NULL DEFAULT 0 CHECK (mesas >= 0 AND mesas <= 60),
  fuera_servicio BOOLEAN NOT NULL DEFAULT FALSE,
  motivo         TEXT,
  notas          TEXT,
  x INTEGER NOT NULL, y INTEGER NOT NULL, w INTEGER NOT NULL, h INTEGER NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una fila = una sesión semanal (un día de la semana) de una materia.
-- dia: 0 = domingo … 6 = sábado. Fechas nulas = vigente sin límite.
CREATE TABLE IF NOT EXISTS clases (
  id             SERIAL PRIMARY KEY,
  programa       TEXT NOT NULL,
  materia        TEXT,
  tipo           TEXT NOT NULL DEFAULT 'semestral' CHECK (tipo IN ('semestral', 'trimestral', 'otro')),
  profesor       TEXT,
  fecha_inicio   DATE,
  fecha_fin      DATE,
  dia            SMALLINT NOT NULL CHECK (dia BETWEEN 0 AND 6),
  hora_inicio    TIME NOT NULL,
  hora_fin       TIME NOT NULL,
  salon_id       INTEGER REFERENCES salones(id) ON DELETE SET NULL,
  alumnos        INTEGER CHECK (alumnos >= 0),
  notas          TEXT,
  gcal_event_id  TEXT,
  gcal_hash      TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fin > hora_inicio),
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS clases_salon_dia_idx ON clases (salon_id, dia);
