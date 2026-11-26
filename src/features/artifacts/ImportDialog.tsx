import type { FormEvent } from 'react';
import { ArrowUpRight, FileJson, X } from 'lucide-react';

export function ImportDialog({ hasGraph, error, status, onClose, onSubmit, onManifest, onCatalog }: {
  hasGraph: boolean;
  error: string;
  status: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onManifest: (file: File | null) => void;
  onCatalog: (file: File | null) => void;
}) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && hasGraph) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
    <div className="modal-head"><span className="title-icon"><FileJson size={19} /></span>{hasGraph && <button className="icon-button" onClick={onClose} aria-label="Close import dialog"><X size={18} /></button>}</div>
    <h2 id="import-title">Bring your lineage to life</h2><p>Choose your dbt artifacts to explore your project's dependencies. Files are read locally on your device.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <form onSubmit={onSubmit}><label className="file-label">Manifest <span>Required</span><input type="file" accept=".json,application/json" onChange={(event) => onManifest(event.target.files?.[0] || null)} /></label><label className="file-label">Catalog <span>Required</span><input type="file" accept=".json,application/json" onChange={(event) => onCatalog(event.target.files?.[0] || null)} /></label><button className="submit-button" type="submit" disabled={Boolean(status)}>{status || 'Explore lineage'} <ArrowUpRight size={16} /></button></form>
    <small>Generate artifacts with <code>dbt compile</code> and <code>dbt docs generate</code>.</small>
  </div></div>;
}
