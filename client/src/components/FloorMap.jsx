import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Mesas, { frenteDe } from './Mesas.jsx';
import { PLANTAS } from '../lib/tiempo.js';
import META from '../plans/meta.json';
import baja from '../plans/baja.svg?raw';
import primera from '../plans/primera.svg?raw';
import segunda from '../plans/segunda.svg?raw';

// Solo el contenido del <svg> (sin la etiqueta raíz ni su <style>, que se define en styles.css).
const interior = raw => raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<style>[\s\S]*?<\/style>/, '');
const PLANOS = { baja: interior(baja), primera: interior(primera), segunda: interior(segunda) };

const ETIQUETA = { ocupado: 'Ocupado', libre: 'Libre', fuera: 'Fuera de servicio', na: '' };

// Pastilla de estado: roja ocupado, verde libre, ámbar fuera de servicio.
function Badge({ estado, cx, cy, fs }) {
  const txt = ETIQUETA[estado];
  const ref = useRef(null);
  const [tw, setTw] = useState(txt.length * fs * 0.55);
  // Ancho real del texto para que el relleno quede igual a ambos lados.
  useLayoutEffect(() => { const b = ref.current?.getBBox(); if (b?.width) setTw(b.width); }, [txt, fs]);
  const w = tw + fs * 1.4, h = fs * 1.6;
  return (
    <g className={`badge-estado ${estado}`}>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={h / 2} />
      <text ref={ref} x={cx} y={cy} fontSize={fs} textAnchor="middle" dominantBaseline="central">{txt}</text>
    </g>
  );
}

// Área de interacción (planta baja): rótulo puesto a mano en el centro del pasillo, entre los cubículos
// y la fachada. Su rectángulo en salones.json se encima con los cubículos, por eso no se usa para centrar.
const FIJA = { codigo: '6104', x: 3077, y: 201, fs: 64 };

export default function FloorMap({ planta, setPlanta, salones, estados, salonSel, onSelect, conteos, esAdmin }) {
  const svgRef = useRef(null);
  const vb = useRef(null);
  const movido = useRef(false);
  const punteros = useRef(new Map());
  const gesto = useRef(null);

  const aplicar = () => {
    const v = vb.current;
    svgRef.current?.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  };
  const reiniciar = () => {
    const [x, y, w, h] = META[planta];
    vb.current = { x, y, w, h };
    aplicar();
  };
  useLayoutEffect(reiniciar, [planta]);

  const aSvg = (cx, cy) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  // Unidades del plano por píxel de pantalla (preserveAspectRatio "meet").
  const upp = () => {
    const r = svgRef.current.getBoundingClientRect();
    return Math.max(vb.current.w / r.width, vb.current.h / r.height);
  };

  const zoom = (f, cx, cy) => {
    const v = vb.current;
    const r = svgRef.current.getBoundingClientRect();
    const p = cx == null ? aSvg(r.left + r.width / 2, r.top + r.height / 2) : aSvg(cx, cy);
    const base = META[planta][2];
    const nw = Math.min(Math.max(v.w / f, base * 0.06), base * 1.6);
    const k = nw / v.w;
    vb.current = { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w: nw, h: v.h * k };
    aplicar();
  };

  useEffect(() => {
    const svg = svgRef.current;
    const onWheel = e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  // Arrastrar para mover; dos dedos para pellizcar. Un arrastre no cuenta como clic.
  const onPointerDown = e => {
    if (e.button !== 0) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movido.current = false;
    iniciarGesto();
  };
  const iniciarGesto = () => {
    const ps = [...punteros.current.values()];
    if (ps.length === 1) gesto.current = { tipo: 'pan', x: ps[0].x, y: ps[0].y, v: { ...vb.current }, upp: upp() };
    else if (ps.length === 2) gesto.current = { tipo: 'pinch', d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) };
  };
  useEffect(() => {
    const move = e => {
      if (!punteros.current.has(e.pointerId)) return;
      punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesto.current;
      const ps = [...punteros.current.values()];
      if (g?.tipo === 'pan' && ps.length === 1) {
        const dx = ps[0].x - g.x, dy = ps[0].y - g.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) movido.current = true;
        vb.current = { ...vb.current, x: g.v.x - dx * g.upp, y: g.v.y - dy * g.upp };
        aplicar();
      } else if (g?.tipo === 'pinch' && ps.length === 2) {
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        movido.current = true;
        zoom(d / g.d, (ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2);
        g.d = d;
      }
    };
    const up = e => {
      if (!punteros.current.delete(e.pointerId)) return;
      iniciarGesto();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  const enPlanta = useMemo(() => salones.filter(s => s.planta === planta), [salones, planta]);

  return (
    <div className="mapa">
      <div className="mapa-barra">
        <div className="tabs">
          {PLANTAS.map(p => (
            <button key={p.id} className={`tab ${p.id === planta ? 'on' : ''}`} onClick={() => setPlanta(p.id)}>
              {p.nombre}
              {conteos[p.id] && <span className="badge" title="Salones ocupados / asignables">{conteos[p.id].ocupados}/{conteos[p.id].total}</span>}
            </button>
          ))}
        </div>
        <div className="zoom">
          <button className="icono-btn" onClick={() => zoom(1.25)} aria-label="Acercar">＋</button>
          <button className="icono-btn" onClick={() => zoom(0.8)} aria-label="Alejar">－</button>
          <button className="icono-btn" onClick={reiniciar} aria-label="Ver planta completa">⤢</button>
        </div>
      </div>
      <svg ref={svgRef} className="plano" preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onClick={() => { if (!movido.current) onSelect(null); }}>
        <g dangerouslySetInnerHTML={{ __html: PLANOS[planta] }} />
        {enPlanta.map(s => {
          const fs = Math.min(55, s.w / 8.5);
          if (s.codigo === FIJA.codigo) {
            // Área fija: no es seleccionable ni editable; rótulo vertical en el centro del pasillo.
            return (
              <g key={s.id} className="sala no-asig fija">
                <text className="sala-nombre" fontSize={FIJA.fs} transform={`translate(${FIJA.x} ${FIJA.y}) rotate(-90)`}
                  dominantBaseline="central">{s.nombre}</text>
              </g>
            );
          }
          if (!s.asignable) {
            // No es salón: solo su nombre al centro. El administrador puede abrirlo para editarlo.
            const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
            return (
              <g key={s.id} className={`sala no-asig ${esAdmin ? 'editable' : ''} ${s.id === salonSel ? 'sel' : ''}`}
                onClick={esAdmin ? e => { e.stopPropagation(); if (!movido.current) onSelect(s.id); } : undefined}>
                <rect className="sala-fondo" x={s.x} y={s.y} width={s.w} height={s.h} />
                <text className="sala-nombre" x={cx} y={cy} fontSize={fs} dominantBaseline="central">{s.nombre}</text>
              </g>
            );
          }
          const st = estados[s.id] || { estado: 'na' };
          const banda = fs * 3.2 + 32;
          const detalle = st.clase ? (st.clase.materia || st.clase.programa) : st.evento?.titulo;
          return (
            <g key={s.id} className={`sala ${st.estado} ${s.id === salonSel ? 'sel' : ''}`}
              onClick={e => { e.stopPropagation(); if (!movido.current) onSelect(s.id); }}>
              <rect className="sala-fondo" x={s.x} y={s.y} width={s.w} height={s.h} />
              <text className="sala-nombre" x={s.x + s.w / 2} y={s.y + fs + 14} fontSize={fs}>{s.nombre}</text>
              {ETIQUETA[st.estado] && <Badge estado={st.estado} cx={s.x + s.w / 2} cy={s.y + fs * 1.75 + 18} fs={fs * 0.6} />}
              {detalle && (
                <text className="sala-detalle" x={s.x + s.w / 2} y={s.y + fs * 3 + 28} fontSize={fs * 0.6}>
                  {detalle.length > 34 ? detalle.slice(0, 33) + '…' : detalle}
                </text>
              )}
              {s.mesas > 0 && s.h - banda > 80 && (
                <Mesas x={s.x + 24} y={s.y + banda} w={s.w - 48} h={s.h - banda - 20}
                  mesas={s.mesas} alumnos={st.alumnos || 0} pizarron={false} frente={frenteDe(s)} />
              )}
            </g>
          );
        })}
      </svg>
      <div className="leyenda">
        <span><i className="sw ocupado" />Ocupado</span>
        <span><i className="sw libre" />Libre</span>
        <span><i className="sw fuera" />Fuera de servicio</span>
        <span><i className="sw silla-o" />Silla ocupada</span>
        <span><i className="sw silla-l" />Silla libre</span>
      </div>
    </div>
  );
}
