import { useEffect } from 'react';

/**
 * Diálogo con el patrón del expediente de Justificantes: overlay, encabezado
 * navy con ×, cuerpo desplazable y pie con acciones. Esc o clic fuera cierra.
 */
export default function Modal({ titulo, onCerrar, pie, ancho = 560, as: Tag = 'div', onSubmit, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCerrar]);

  return (
    <div className="modal-ovl" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <Tag className="modal-dlg" style={{ maxWidth: ancho }} onSubmit={onSubmit} role="dialog" aria-modal="true">
        <div className="modal-exp-head">
          <h2>{titulo}</h2>
          <button type="button" className="modal-exp-x" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-dlg-body">{children}</div>
        {pie && <div className="modal-dlg-foot">{pie}</div>}
      </Tag>
    </div>
  );
}
