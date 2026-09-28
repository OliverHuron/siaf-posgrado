import React, { useMemo } from 'react';
import { acomodarMesas } from '../lib/mesas.js';

// Mesas rectangulares con 2 sillas cada una. Las primeras `alumnos` sillas se pintan ocupadas (verde).
export default function Mesas({ x, y, w, h, mesas, alumnos = 0, pizarron = true }) {
  const top = pizarron ? Math.min(60, h * 0.1) : 0;
  const lay = useMemo(() => acomodarMesas(mesas, w, h - top), [mesas, w, h, top]);
  return (
    <g transform={`translate(${x} ${y})`} className="mesas">
      {pizarron && <rect className="pizarron" x={w * 0.2} y={0} width={w * 0.6} height={Math.max(6, top * 0.22)} rx="3" />}
      <g transform={`translate(0 ${top})`}>
        {lay.mesas.map((m, i) => (
          <rect key={`m${i}`} className="mesa" x={m.x} y={m.y} width={m.w} height={m.h} rx={4 * lay.escala} />
        ))}
        {lay.sillas.map((s, i) => (
          <rect key={`s${i}`} className={`silla ${i < alumnos ? 'ocupada' : 'libre'}`}
            x={s.x} y={s.y} width={s.w} height={s.h} rx={9 * lay.escala} />
        ))}
      </g>
    </g>
  );
}
