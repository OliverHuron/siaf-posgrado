// Acomoda `n` mesas (cada una con 2 sillas) en un rectángulo w×h, en filas mirando al frente (arriba).
// Unidades del plano ≈ centímetros. Devuelve mesas y sillas en coordenadas locales del rectángulo.
const MESA = { w: 120, h: 50 };
const SILLA = { w: 42, h: 38, sep: 8 };          // separación silla-mesa
const HUECO = { x: 30, y: 40 };                  // pasillos entre columnas / filas
const UNIDAD = { w: MESA.w + HUECO.x, h: MESA.h + SILLA.sep + SILLA.h + HUECO.y };

export function acomodarMesas(n, w, h) {
  if (n <= 0 || w <= 0 || h <= 0) return { mesas: [], sillas: [], escala: 1 };
  // Probar todas las columnas posibles y quedarse con la que permite la mayor escala.
  let mejor = null;
  for (let cols = 1; cols <= n; cols++) {
    const filas = Math.ceil(n / cols);
    const escala = Math.min(1, w / (cols * UNIDAD.w), h / (filas * UNIDAD.h));
    if (!mejor || escala > mejor.escala + 1e-6) mejor = { cols, filas, escala };
  }
  const { cols, filas, escala: s } = mejor;
  const uw = UNIDAD.w * s, uh = UNIDAD.h * s;
  const ox = (w - cols * uw) / 2, oy = (h - filas * uh) / 2;
  const mesas = [], sillas = [];
  for (let i = 0; i < n; i++) {
    const fila = Math.floor(i / cols);
    // La última fila se centra si viene incompleta.
    const enFila = fila === filas - 1 ? n - fila * cols : cols;
    const col = i % cols;
    const x = ox + (cols - enFila) * uw / 2 + col * uw + (HUECO.x * s) / 2;
    const y = oy + fila * uh + (HUECO.y * s) / 2;
    mesas.push({ x, y, w: MESA.w * s, h: MESA.h * s });
    const sy = y + (MESA.h + SILLA.sep) * s;
    for (const k of [0, 1]) {
      const cx = x + (MESA.w * s) * (k === 0 ? 0.27 : 0.73);
      sillas.push({ x: cx - (SILLA.w * s) / 2, y: sy, w: SILLA.w * s, h: SILLA.h * s, mesa: i });
    }
  }
  return { mesas, sillas, escala: s };
}
