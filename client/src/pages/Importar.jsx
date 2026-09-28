import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../api.js';

const quitarAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// Hoja → filas {encabezado: valor}. Busca la fila de encabezados (la que dice POSGRADO) y
// copia el valor de las celdas combinadas a todo su rango, como se ve en el Excel.
function leerHoja(ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
  const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (const m of ws['!merges'] || []) {
    const r0 = m.s.r - ref.s.r, c0 = m.s.c - ref.s.c;
    const v = aoa[r0]?.[c0];
    for (let r = r0; r <= m.e.r - ref.s.r; r++) {
      if (!aoa[r]) continue;
      for (let c = c0; c <= m.e.c - ref.s.c; c++) if (aoa[r][c] === '' || aoa[r][c] === undefined) aoa[r][c] = v;
    }
  }
  const iEnc = aoa.findIndex((f) => f.some((c) => quitarAcentos(c).startsWith('POSGRADO')));
  if (iEnc < 0) throw new Error('No se encontró la fila de encabezados (debe tener una columna "POSGRADO")');
  const enc = aoa[iEnc].map((c) => String(c).trim());
  return aoa.slice(iEnc + 1)
    .map((f) => Object.fromEntries(enc.map((h, i) => [h, f[i] ?? '']).filter(([h]) => h)))
    .filter((f) => Object.values(f).some((v) => v !== ''));
}

export default function Importar() {
  const { cargarClases, cargarSalones } = useOutletContext();
  const [archivo, setArchivo] = useState('');
  const [libro, setLibro] = useState(null);
  const [hoja, setHoja] = useState('');
  const [filas, setFilas] = useState(null);
  const [anioBase, setAnioBase] = useState(new Date().getFullYear());
  const [modo, setModo] = useState('agregar');
  const [err, setErr] = useState('');
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const elegirHoja = (wb, nombre) => {
    setHoja(nombre); setErr(''); setResultado(null);
    try { setFilas(leerHoja(wb.Sheets[nombre])); } catch (e) { setFilas(null); setErr(e.message); }
  };

  const cargarArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivo(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      setLibro(wb);
      elegirHoja(wb, wb.SheetNames[0]);
    } catch { setErr('No se pudo leer el archivo. ¿Es un Excel (.xlsx / .xls)?'); }
  };

  const importar = async () => {
    if (modo === 'reemplazar' && !window.confirm('Se borrarán TODAS las clases actuales y se cargarán las del Excel. ¿Continuar?')) return;
    setEnviando(true); setErr('');
    try {
      const r = await api('/clases/importar', { method: 'POST', body: { filas, anioBase, modo } });
      setResultado(r);
      cargarClases(); cargarSalones();
    } catch (e) { setErr(e.message); } finally { setEnviando(false); }
  };

  const columnas = filas?.length ? Object.keys(filas[0]) : [];

  return (
    <div className="wrap-pagina">
      <h1>Importar horario desde Excel</h1>
      <p className="sub">
        Columnas reconocidas: POSGRADO, MATERIA, TIPO, INICIO, FINAL, PROFESOR, DÍAS, HORA, SALÓN y PISO.
        Las celdas combinadas se respetan.
      </p>

      {err && <div className="aviso error">{err}</div>}
      {resultado && (
        <div className="aviso exito">
          <strong>{resultado.insertadas} clases importadas{resultado.fueraServicio ? ` · ${resultado.fueraServicio} salón(es) marcados fuera de servicio` : ''}.</strong>
          {resultado.avisos.length > 0 && <ul className="lista-avisos">{resultado.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
        </div>
      )}

      <div className="card">
        <label className="archivo-drop">
          <input type="file" accept=".xlsx,.xls,.xlsm,.csv" onChange={cargarArchivo} hidden />
          {archivo ? <span><b>{archivo}</b> · clic para cambiar</span> : <span>Haz clic para elegir el archivo de Excel del horario</span>}
        </label>

        <div className="form-grid" style={{ marginTop: 6 }}>
          {libro && libro.SheetNames.length > 1 && (
            <div><label>Hoja</label>
              <select value={hoja} onChange={(e) => elegirHoja(libro, e.target.value)}>
                {libro.SheetNames.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          )}
          <div><label>Año base del periodo</label>
            <input type="number" min="2020" max="2100" value={anioBase} onChange={(e) => setAnioBase(Number(e.target.value))} />
          </div>
          <div><label>Modo</label>
            <select value={modo} onChange={(e) => setModo(e.target.value)}>
              <option value="agregar">Agregar al horario actual</option>
              <option value="reemplazar">Reemplazar todo el horario</option>
            </select>
          </div>
        </div>
        <p className="hint">Fechas como “24 de agosto”: de junio a diciembre se toma el año base; de enero a mayo, el siguiente.</p>

        <div className="fila fila-sep" style={{ marginTop: 14 }}>
          <span className="hint">{filas ? `${filas.length} filas leídas de “${hoja}”` : 'Sin archivo'}</span>
          <button disabled={!filas?.length || enviando} onClick={importar}>{enviando ? 'Importando…' : 'Importar'}</button>
        </div>
      </div>

      {filas?.length > 0 && (
        <div className="card tabla-scroll tabla-siaf">
          <table>
            <thead><tr>{columnas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {filas.slice(0, 15).map((f, i) => (
                <tr key={i}>{columnas.map((c) => <td key={c}>{String(f[c])}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {filas.length > 15 && <p className="hint" style={{ padding: '8px 12px' }}>… y {filas.length - 15} filas más.</p>}
        </div>
      )}
    </div>
  );
}
