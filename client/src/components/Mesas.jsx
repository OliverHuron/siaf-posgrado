import React, { useMemo } from 'react';
import { acomodarMesas } from '../lib/mesas.js';

// Símbolos de mesa y silla (basados en mesa-2-sillas-referencia.svg). Se montan una sola vez por página;
// <use> los referencia desde cualquier <svg> del documento.
// La silla está girada 90° para que el asiento mire hacia la mesa (arriba); el asiento usa currentColor
// para pintar ocupada/libre.
export function MesaDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mz-mesa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe1e0" /><stop offset=".3" stopColor="#eef0ef" />
          <stop offset=".55" stopColor="#e2e4e3" /><stop offset=".8" stopColor="#f1f2f1" /><stop offset="1" stopColor="#d9dcdb" />
        </linearGradient>
        <pattern id="mz-veta" width="60" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 .6 C15 .9 30 .3 45 .7 S58 .5 60 .6 M0 2.2 C12 2 28 2.5 40 2.1 S55 2.4 60 2.2 M0 3.4 C20 3.6 35 3.2 60 3.5"
            fill="none" stroke="#8f9593" strokeWidth=".35" opacity=".45" />
          <path d="M0 1.4 C18 1.6 36 1.2 60 1.5" fill="none" stroke="#fff" strokeWidth=".3" opacity=".7" />
        </pattern>
        <pattern id="mz-tela" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r=".75" fill="#9b9fa0" opacity=".48" />
          <circle cx="5.1" cy="5.1" r=".7" fill="#050607" opacity=".55" />
          <circle cx="5.1" cy="1.6" r=".42" fill="#d0d2d2" opacity=".22" />
        </pattern>
        <linearGradient id="mz-respaldo" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#111213" /><stop offset="1" stopColor="#343638" />
        </linearGradient>

        <symbol id="mz-mesa-sym" viewBox="0 0 120 50" preserveAspectRatio="none">
          <rect x="1.5" y="2" width="118.5" height="48" rx="3" fill="#4d5352" opacity=".25" />
          <rect x=".5" y=".5" width="117" height="47" rx="3" fill="url(#mz-mesa)" stroke="#9aa09d" strokeWidth=".8" />
          <rect x=".5" y=".5" width="117" height="47" rx="3" fill="url(#mz-veta)" />
          <rect x="2.5" y="2.5" width="113" height="43" rx="2" fill="none" stroke="#fff" strokeWidth=".6" opacity=".8" />
        </symbol>

        <symbol id="mz-silla-sym" viewBox="-137 8 137 131">
          <g transform="rotate(90)">
            <path d="M113 7 C126 25 132 46 132 68 C132 91 126 112 113 130" fill="none" stroke="#202224" strokeWidth="14" strokeLinecap="round" />
            <path d="M113 7 C126 25 132 46 132 68 C132 91 126 112 113 130" fill="none" stroke="#707477" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
            <path d="M9 30 C9 13 22 4 39 4 H70 C87 4 100 15 100 31 V105 C100 121 88 132 72 132 H38 C21 132 9 120 9 104 Z"
              fill="url(#mz-respaldo)" stroke="#0d0e0f" strokeWidth="2" />
            <path d="M9 30 C9 13 22 4 39 4 H70 C87 4 100 15 100 31 V105 C100 121 88 132 72 132 H38 C21 132 9 120 9 104 Z"
              fill="url(#mz-tela)" opacity=".8" />
            <path d="M20 35 C31 29 70 29 87 36 C93 39 95 48 93 61 C91 74 88 82 82 87 C69 94 38 94 25 87 C19 82 16 72 16 60 C16 48 17 40 20 35 Z"
              fill="currentColor" />
            <path d="M20 35 C31 29 70 29 87 36 C93 39 95 48 93 61 C91 74 88 82 82 87 C69 94 38 94 25 87 C19 82 16 72 16 60 C16 48 17 40 20 35 Z"
              fill="url(#mz-tela)" opacity=".9" />
            <path d="M96 42 H113 M96 95 H113" stroke="#252729" strokeWidth="5" strokeLinecap="round" />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}

// Hacia dónde miran los alumnos según el tipo de salón: aulas al pizarrón de la izquierda, cómputo a la derecha.
export const frenteDe = salon => (salon.tipo === 'computo' ? 'der' : 'izq');

// El acomodo se calcula mirando "arriba" y luego se gira 90° para que el frente quede a la izquierda o derecha.
// En ambos casos la esquina izquierda del frente (escritorio del maestro) cae en la parte superior del salón.
const GIRO = {
  arriba: () => '',
  izq: () => 'matrix(0 1 1 0 0 0)',
  der: w => `matrix(0 1 -1 0 ${w} 0)`,
};

// Mesas con 2 sillas cada una, más el escritorio del maestro. Las primeras `alumnos` sillas llevan un
// círculo verde. Requiere <MesaDefs /> montado en la página.
export default function Mesas({ x, y, w, h, mesas, alumnos = 0, pizarron = true, frente = 'izq', maestro = true }) {
  const girado = frente !== 'arriba';
  const [fw, fh] = girado ? [h, w] : [w, h]; // marco en orientación "mirando arriba"
  const top = pizarron ? Math.min(60, fh * 0.1) : 0;
  const lay = useMemo(() => acomodarMesas(mesas, fw, fh - top, { maestro }), [mesas, fw, fh, top, maestro]);
  const p = lay.maestro;
  return (
    <g transform={`translate(${x} ${y})`} className="mesas">
      <g transform={GIRO[frente](w)}>
        {pizarron && <rect className="pizarron" x={fw * 0.2} y={0} width={fw * 0.6} height={Math.max(6, top * 0.22)} rx="3" />}
        <g transform={`translate(0 ${top})`}>
          {p && <>
            <use href="#mz-mesa-sym" x={p.mesa.x} y={p.mesa.y} width={p.mesa.w} height={p.mesa.h} />
            <use href="#mz-silla-sym" className="silla maestro" x={p.silla.x} y={p.silla.y} width={p.silla.w} height={p.silla.h}
              transform={`rotate(180 ${p.silla.x + p.silla.w / 2} ${p.silla.y + p.silla.h / 2})`} />
          </>}
          {lay.mesas.map((m, i) => (
            <use key={`m${i}`} href="#mz-mesa-sym" x={m.x} y={m.y} width={m.w} height={m.h} />
          ))}
          {lay.sillas.map((s, i) => (
            <use key={`s${i}`} href="#mz-silla-sym" className="silla" x={s.x} y={s.y} width={s.w} height={s.h} />
          ))}
          {/* Punto verde sobre el asiento de cada silla con alumno. */}
          {lay.sillas.slice(0, alumnos).map((s, i) => (
            <circle key={`a${i}`} className="silla-alumno" cx={s.x + s.w * 0.5} cy={s.y + s.h * 0.4} r={s.w * 0.2} />
          ))}
        </g>
      </g>
    </g>
  );
}
