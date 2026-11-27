import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { FileJson, Network, Table2, X } from 'lucide-react';
import { ResourceIcon } from '../../../components/ResourceIcon.tsx';
import type { LineageGraph, Resource } from '../../../types/lineage.ts';
import './ResourceDetails.css';

const MIN_WIDTH = 200;
const maxWidth = () => Math.max(MIN_WIDTH, Math.min(900, window.innerWidth - 48));
const clampWidth = (width: number) => Math.max(MIN_WIDTH, Math.min(maxWidth(), width));

export function ResourceDetails({ resource, graph, rootId, readSource, onClose, onFocus }: {
  resource: Resource;
  graph: LineageGraph;
  rootId: string;
  readSource: ((resource: Resource) => Promise<string>) | null;
  onClose: () => void;
  onFocus: (id: string) => void;
}) {
  const [tab, setTab] = useState<'details' | 'code'>('details');
  const tabsId = useId();
  const [width, setWidth] = useState(() => clampWidth(window.innerWidth > 900 && window.innerWidth <= 1250 ? 240 : 285));
  const [source, setSource] = useState<{ reader: NonNullable<typeof readSource>; resource: Resource; code?: string; error?: string } | null>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    const resize = () => setWidth(clampWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (tab !== 'code' || !readSource || resource.type !== 'model') return;
    let active = true;
    setSource(null);
    const reader = readSource;
    async function loadSource() {
      try {
        const code = await reader(resource);
        if (active) setSource({ reader, resource, code });
      } catch (error) {
        if (active) setSource({ reader, resource, error: error instanceof Error ? error.message : String(error) });
      }
    }
    loadSource();
    return () => { active = false; };
  }, [tab, readSource, resource]);

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width };
    event.preventDefault();
  }
  function moveResize(event: PointerEvent<HTMLDivElement>) {
    if (drag.current) setWidth(clampWidth(drag.current.width + drag.current.x - event.clientX));
  }
  function resizeByKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setWidth((current) => clampWidth(current + (event.key === 'ArrowLeft' ? 20 : -20)));
    }
  }

  const currentSource = source?.reader === readSource && source.resource === resource ? source : null;
  return <div className="details-panel" style={{ width }}>
    <div className="details-resize" role="separator" aria-label="Resize resource details" aria-orientation="vertical"
      aria-controls="resource-details" aria-valuemin={MIN_WIDTH} aria-valuemax={maxWidth()} aria-valuenow={width}
      tabIndex={0} onPointerDown={startResize} onPointerMove={moveResize}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }} onKeyDown={resizeByKey} />
    <aside id="resource-details" className="details">
      <div className="details-top"><span className="eyebrow">RESOURCE DETAILS</span><button className="icon-button" onClick={onClose} title="Close details" aria-label="Close details"><X size={17} /></button></div>
      <div className="details-identity"><span className={`detail-icon ${resource.type}`}><ResourceIcon type={resource.type} size={20} /></span><div><h2>{resource.name}</h2><span className={`type-label ${resource.type}`}>{resource.type}</span></div></div>
      <div className="details-tabs" role="tablist" aria-label="Resource information" onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          const next = tab === 'details' ? 'code' : 'details';
          setTab(next);
          document.getElementById(`${tabsId}-${next}`)?.focus();
        }
      }}>
        <button id={`${tabsId}-details`} role="tab" aria-controls={`${tabsId}-panel`} aria-selected={tab === 'details'} tabIndex={tab === 'details' ? 0 : -1} onClick={() => setTab('details')}>Details</button>
        <button id={`${tabsId}-code`} role="tab" aria-controls={`${tabsId}-panel`} aria-selected={tab === 'code'} tabIndex={tab === 'code' ? 0 : -1} onClick={() => setTab('code')}>Raw code</button>
      </div>
      {tab === 'details' ? <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-details`}>
        <p className="details-description">{resource.description || 'No description provided for this resource.'}</p>
        {resource.id !== rootId && <button className="focus-button" onClick={() => onFocus(resource.id)}><Network size={15} /> Explore lineage</button>}
        <div className="detail-section"><h3>OVERVIEW</h3><dl><div><dt>Package</dt><dd>{resource.packageName || '—'}</dd></div><div><dt>Schema</dt><dd>{resource.schema || '—'}</dd></div><div><dt>Database</dt><dd>{resource.database || '—'}</dd></div><div><dt>Materialization</dt><dd>{resource.materialization || '—'}</dd></div><div><dt>Upstream</dt><dd>{graph.parents[resource.id].length} resources</dd></div><div><dt>Downstream</dt><dd>{graph.children[resource.id].length} resources</dd></div></dl></div>
        <div className="detail-section columns-section"><h3>COLUMNS <span>{resource.columns.length}</span></h3>{resource.columns.length ? resource.columns.map((column, i) => <div className="column-row" key={`${column.name}-${i}`}><div><Table2 size={14} /><strong>{column.name}</strong></div><small>{column.type || column.data_type || '—'}</small>{column.comment && <p>{column.comment}</p>}</div>) : <p className="no-columns">No column metadata available.</p>}</div>
        <div className="details-note"><FileJson size={15} /><span>Column metadata comes from your dbt artifacts. Connections represent resource dependencies.</span></div>
      </div> : <div className="source-view" id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-code`}>
        {resource.type !== 'model' ? <p>Raw code is available for models only.</p>
          : !readSource ? <p>Select a dbt project folder in Import artifacts to view model source code.</p>
            : currentSource?.error ? <p role="alert">{currentSource.error}</p>
              : currentSource?.code !== undefined ? <pre tabIndex={0}><code>{currentSource.code}</code></pre>
                : <p>Loading source code…</p>}
      </div>}
    </aside>
  </div>;
}
