import { query } from '../db.js';

// Clases del mismo salón que se enciman con `c` (mismo día, horas traslapadas, periodos traslapados).
export async function buscarConflictos(c, excluirId = null) {
  if (!c.salon_id) return [];
  const { rows } = await query(
    `SELECT id, programa, materia, profesor, dia, hora_inicio, hora_fin, fecha_inicio, fecha_fin
       FROM clases
      WHERE salon_id = $1 AND dia = $2
        AND hora_inicio < $4::time AND hora_fin > $3::time
        AND COALESCE(fecha_inicio, '-infinity'::date) <= COALESCE($6::date, 'infinity'::date)
        AND COALESCE(fecha_fin, 'infinity'::date) >= COALESCE($5::date, '-infinity'::date)
        AND ($7::int IS NULL OR id <> $7)
      ORDER BY hora_inicio`,
    [c.salon_id, c.dia, c.hora_inicio, c.hora_fin, c.fecha_inicio || null, c.fecha_fin || null, excluirId]
  );
  return rows;
}
