import pg from 'pg';

// DATE sin conversión a Date de JS: se maneja como 'YYYY-MM-DD'.
pg.types.setTypeParser(1082, v => v);

export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
});

export const query = (text, params) => pool.query(text, params);
