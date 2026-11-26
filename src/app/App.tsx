import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { ReactFlowProvider } from '@xyflow/react';
import {
  ArrowUpRight, Boxes, ChevronDown, CircleHelp, Database, FileJson, Filter, GitBranch, Layers2,
  Moon, Network, PanelLeftClose, Search, Sun, Table2, Upload, X,
} from 'lucide-react';
import { ImportDialog } from '../features/artifacts/ImportDialog.tsx';
import { LineageCanvas } from '../features/lineage/LineageCanvas.tsx';
import { ResourceIcon } from '../features/lineage/ResourceIcon.tsx';
import { buildLineage, defaultResource } from '../features/lineage/lineage.ts';
import type { LineageGraph, Theme } from '../features/lineage/types.ts';

const desktop = isTauri();

export function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('lineage-theme') === 'dark' ? 'dark' : 'light';
    } catch (error) {
      console.warn('Could not read the saved theme preference:', error);
      return 'light';
    }
  });
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [rootId, setRootId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [graphVersion, setGraphVersion] = useState(0);
  const [status, setStatus] = useState(desktop ? '' : 'Loading local dbt artifacts…');
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(desktop);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 600);
  const requestId = useRef(0);

  const loadGraph = useCallback((manifest: unknown, catalog: unknown) => {
    const next = buildLineage(manifest, catalog);
    const first = defaultResource(next);
    setGraph(next); setRootId(first); setSelectedId(''); setSearch(''); setFilter('all');
    setGraphVersion((version) => version + 1);
    setStatus(''); setError(''); setShowImport(false);
  }, []);

  useEffect(() => {
    if (desktop) return undefined;
    const request = ++requestId.current;
    async function loadLocal() {
      try {
        const responses = await Promise.all(['/api/artifacts/manifest', '/api/artifacts/catalog'].map((url) => fetch(url)));
        if (responses.some((response) => !response.ok)) throw new Error('Could not load target/manifest.json and target/catalog.json. Generate them with dbt or import both files.');
        const [manifest, catalog] = await Promise.all(responses.map((response) => response.json()));
        if (request === requestId.current) loadGraph(manifest, catalog);
      } catch (err) {
        if (request === requestId.current) { setError(err instanceof Error ? err.message : String(err)); setStatus(''); setShowImport(true); }
      }
    }
    loadLocal();
    return () => { requestId.current++; };
  }, [loadGraph]);

  async function importFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manifestFile || !catalogFile) { setError('Choose both manifest.json and catalog.json.'); return; }
    const request = ++requestId.current;
    setStatus('Reading selected artifacts…'); setError('');
    try {
      const [manifest, catalog] = await Promise.all([manifestFile.text().then(JSON.parse), catalogFile.text().then(JSON.parse)]);
      if (request === requestId.current) loadGraph(manifest, catalog);
    } catch (err) {
      if (request === requestId.current) { setError(`Could not import artifacts: ${err instanceof Error ? err.message : String(err)}`); setStatus(''); }
    }
  }

  const resources = useMemo(() => graph ? Object.values(graph.resources) : [], [graph]);
  const counts = useMemo(() => resources.reduce<Record<string, number>>((acc, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc; }, {}), [resources]);
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return resources.filter((item) => (filter === 'all' || item.type === filter) &&
      (!query || [item.name, item.schema, item.packageName, item.sourceName, item.id].some((value) => value.toLowerCase().includes(query))));
  }, [resources, search, filter]);
  const selected = graph?.resources[selectedId];
  const focus = (id: string) => { setRootId(id); setSelectedId(''); setGraphVersion((version) => version + 1); };
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('lineage-theme', next);
    } catch (error) {
      console.warn('Could not save the theme preference:', error);
    }
  };

  return <div className="app" data-theme={theme}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><GitBranch size={19} /></div><div><strong>lineage<span>studio</span></strong><small>YOUR DATA, CONNECTED</small></div></div>
      <div className="topbar-divider" />
      <div className="workspace-label"><span className="workspace-icon"><Boxes size={15} /></span><span>{graph?.metadata.project_name || 'dbt project'}<small>Workspace</small></span><ChevronDown size={14} /></div>
      <div className="topbar-spacer" />
      <div className="local-badge"><span className="live-dot" /> Local workspace</div>
      <button className="theme-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>
      <button className="import-button" onClick={() => { setShowImport(true); setError(''); }}><Upload size={15} /> Import artifacts</button>
      <div className="avatar">LS</div>
    </header>

    <div className="app-body">
      <aside className="rail">
        <div className="rail-group"><button className="rail-button active" title="Lineage"><Network size={19} /></button><button className="rail-button" title="Browse resources" onClick={() => setSidebarOpen(true)}><Boxes size={19} /></button></div>
        <div className="rail-bottom"><button className="rail-button" title="About this view" onClick={() => setShowImport(true)}><CircleHelp size={19} /></button><div className="rail-avatar">L</div></div>
      </aside>
      {sidebarOpen && <aside className="sidebar">
        <div className="sidebar-head"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Explore</h2></div><button className="icon-button" title="Hide explorer" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={17} /></button></div>
        <p className="sidebar-description">Discover and explore your data assets.</p>
        <label className="search-box"><Search size={16} /><input placeholder="Search resources..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="filter-row"><span><Filter size={13} /> RESOURCE TYPE</span><select aria-label="Filter resource type" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All types</option>{Object.keys(counts).sort().map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
        <div className="list-heading"><span>RESOURCES <span className="count-pill">{matches.length.toLocaleString()}</span></span><span>NAME</span></div>
        <div className="resource-list">
          {matches.slice(0, 100).map((resource) => <button key={resource.id} className={`resource-item ${rootId === resource.id ? 'active' : ''}`} onClick={() => focus(resource.id)} title={resource.id}>
            <span className={`list-icon ${resource.type}`}><ResourceIcon type={resource.type} size={15} /></span><span className="resource-name"><strong>{resource.name}</strong><small>{resource.schema || resource.packageName || resource.type}</small></span><span className="item-chevron">›</span>
          </button>)}
          {matches.length > 100 && <div className="list-more">Showing 100 of {matches.length.toLocaleString()} resources. Search to narrow results.</div>}
          {graph && matches.length === 0 && <div className="list-more">No matching resources.</div>}
        </div>
        <div className="sidebar-footer"><span className="footer-icon"><GitBranch size={16} /></span><span><strong>dbt lineage</strong><small>Powered by your artifacts</small></span><span className="footer-status">●</span></div>
      </aside>}
      <main className="main">
        <div className="page-heading">
          <div className="breadcrumbs"><button onClick={() => setSidebarOpen(true)}>Workspace</button><span>/</span><span>Lineage explorer</span></div>
          <div className="title-row"><div><div className="title-with-icon"><span className="title-icon"><Network size={20} /></span><h1>Lineage explorer</h1><span className="beta">LOCAL</span></div><p>Understand how your data flows, from source to insight.</p></div><div className="heading-summary"><span><i className="summary-dot model-dot" /> {counts.model?.toLocaleString() || 0} models</span><span><i className="summary-dot source-dot" /> {counts.source?.toLocaleString() || 0} sources</span></div></div>
        </div>
        <div className="graph-card">
          {graph ? <ReactFlowProvider key={graphVersion}><LineageCanvas graph={graph} rootId={rootId} selectedId={selectedId} setSelectedId={setSelectedId} theme={theme} /></ReactFlowProvider> : <><div className="graph-toolbar"><div className="graph-title"><span className="graph-icon"><GitBranch size={16} /></span><div><strong>Data lineage</strong><small>Select a resource to explore</small></div></div></div><div className="loading-state"><Network size={32} /><strong>{status || 'No artifacts loaded'}</strong><span>{error || 'Preparing your lineage graph'}</span><button onClick={() => setShowImport(true)}>Import artifacts</button></div></>}
          <div className="graph-legend"><span>LEGEND</span><span><i className="legend-icon source"><Database size={12} /></i> Source</span><span><i className="legend-icon model"><Layers2 size={12} /></i> Model</span><span><i className="legend-icon seed"><Table2 size={12} /></i> Seed</span><span><i className="legend-icon exposure"><ArrowUpRight size={12} /></i> Exposure</span><div className="legend-spacer" /><span>Model-level lineage</span></div>
        </div>
        <div className="page-foot"><span>Built for a clearer view of your data.</span><span>Data stays in your local workspace <span className="heart">✦</span></span></div>
      </main>
      {selected && <aside className="details">
        <div className="details-top"><span className="eyebrow">RESOURCE DETAILS</span><button className="icon-button" onClick={() => setSelectedId('')} title="Close details"><X size={17} /></button></div>
        <div className="details-identity"><span className={`detail-icon ${selected.type}`}><ResourceIcon type={selected.type} size={20} /></span><div><h2>{selected.name}</h2><span className={`type-label ${selected.type}`}>{selected.type}</span></div></div>
        <p className="details-description">{selected.description || 'No description provided for this resource.'}</p>
        {selected.id !== rootId && <button className="focus-button" onClick={() => focus(selected.id)}><Network size={15} /> Explore lineage</button>}
        <div className="detail-section"><h3>OVERVIEW</h3><dl><div><dt>Package</dt><dd>{selected.packageName || '—'}</dd></div><div><dt>Schema</dt><dd>{selected.schema || '—'}</dd></div><div><dt>Database</dt><dd>{selected.database || '—'}</dd></div><div><dt>Materialization</dt><dd>{selected.materialization || '—'}</dd></div><div><dt>Upstream</dt><dd>{graph.parents[selected.id].length} resources</dd></div><div><dt>Downstream</dt><dd>{graph.children[selected.id].length} resources</dd></div></dl></div>
        <div className="detail-section columns-section"><h3>COLUMNS <span>{selected.columns.length}</span></h3>{selected.columns.length ? selected.columns.map((column, i) => <div className="column-row" key={`${column.name}-${i}`}><div><Table2 size={14} /><strong>{column.name}</strong></div><small>{column.type || column.data_type || '—'}</small>{column.comment && <p>{column.comment}</p>}</div>) : <p className="no-columns">No column metadata available.</p>}</div>
        <div className="details-note"><FileJson size={15} /><span>Column metadata comes from your dbt artifacts. Connections represent resource dependencies.</span></div>
      </aside>}
    </div>
    {showImport && <ImportDialog hasGraph={Boolean(graph)} error={error} status={status}
      onClose={() => setShowImport(false)} onSubmit={importFiles} onManifest={setManifestFile} onCatalog={setCatalogFile} />}
  </div>;
}

