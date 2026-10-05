// Acomoda `n` mesas (cada una con 2 sillas) en un rectángulo w×h, en filas mirando al frente (arriba).
// Unidades del plano ≈ centímetros. Devuelve mesas y sillas en coordenadas locales del rectángulo.
// Con `maestro`, reserva al frente una franja para el escritorio del maestro (esquina izquierda del frente).
const MESA = { w: 120, h: 50 };
const SILLA = { w: 42, h: 40, sep: 6 };          // separación silla-mesa
const HUECO = { x: 30, y: 40 };                  // pasillos entre columnas / filas
const UNIDAD = { w: MESA.w + HUECO.x, h: MESA.h + SILLA.sep + SILLA.h + HUECO.y };
const FRANJA = SILLA.h + SILLA.sep + MESA.h + HUECO.y; // silla del maestro, su mesa y pasillo

export function acomodarMesas(n, w, h, { maestro = false } = {}) {
  const vacio = { mesas: [], sillas: [], maestro: null, escala: 1 };
  if (w <= 0 || h <= 0 || (n <= 0 && !maestro)) return vacio;
  const franja = maestro ? FRANJA : 0;
  // Probar todas las columnas posibles y quedarse con la mayor escala; en empate, con más mesas por fila.
  // Así, mientras quepan a tamaño real, la cuadrícula la fija el salón y cada fila (columna en pantalla,
  // ya girado) se llena completa antes de empezar la siguiente.
  let mejor = { cols: 1, filas: Math.max(1, n), escala: Math.min(1, w / UNIDAD.w, h / (Math.max(1, n) * UNIDAD.h + franja)) };
  const maxCols = Math.max(n, Math.floor(w / UNIDAD.w));
  for (let cols = 2; cols <= maxCols; cols++) {
    const filas = Math.max(1, Math.ceil(n / cols));
    const escala = Math.min(1, w / (cols * UNIDAD.w), h / (filas * UNIDAD.h + franja));
    if (escala >= mejor.escala - 1e-6) mejor = { cols, filas, escala };
  }
  const { cols, escala: s } = mejor;
  const uw = UNIDAD.w * s, uh = UNIDAD.h * s;
  const ox = (w - cols * uw) / 2;
  const oy = 0; // se acomoda desde el frente; el espacio sobrante queda al fondo
  const mesas = [], sillas = [];
  for (let i = 0; i < n; i++) {
    const fila = Math.floor(i / cols);
    const col = i % cols;
    const x = ox + col * uw + (HUECO.x * s) / 2;
    const y = oy + franja * s + fila * uh + (HUECO.y * s) / 2;
    mesas.push({ x, y, w: MESA.w * s, h: MESA.h * s });
    const sy = y + (MESA.h + SILLA.sep) * s;
    for (const k of [0, 1]) {
      const cx = x + (MESA.w * s) * (k === 0 ? 0.27 : 0.73);
      sillas.push({ x: cx - (SILLA.w * s) / 2, y: sy, w: SILLA.w * s, h: SILLA.h * s, mesa: i });
    }
  }
  let prof = null;
  if (maestro) {
    // Pegado a la esquina del frente; la silla queda entre la pared y la mesa, mirando al grupo.
    const x = Math.max(0, ox) + (HUECO.x * s) / 2;
    const y = Math.max(0, oy);
    const mesa = { x, y: y + (SILLA.h + SILLA.sep) * s, w: MESA.w * s, h: MESA.h * s };
    const silla = { x: x + (MESA.w * s - SILLA.w * s) / 2, y, w: SILLA.w * s, h: SILLA.h * s };
    prof = { mesa, silla };
  }
  return { mesas, sillas, maestro: prof, escala: s };
}
