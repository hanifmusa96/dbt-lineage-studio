import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { ReactFlowProvider } from '@xyflow/react';
import {
  ArrowUpRight, Boxes, CircleHelp, Database, Filter, GitBranch, Layers2,
  Moon, Network, PanelLeftClose, Search, Sun, Table2, Upload,
} from 'lucide-react';
import { ImportDialog } from '../features/artifacts/components/ImportDialog.tsx';
import { browserProject, chooseDesktopProject, loadProjectArtifacts, modelPath } from '../features/artifacts/api/project.ts';
import type { Project } from '../features/artifacts/api/project.ts';
import { ExportControls } from '../features/export/components/ExportControls.tsx';
import { LineageCanvas } from '../features/lineage/components/LineageCanvas.tsx';
import { ResourceDetails } from '../features/lineage/components/ResourceDetails.tsx';
import { ResourceIcon } from '../components/ResourceIcon.tsx';
import { buildLineage, defaultResource } from '../features/lineage/utils/lineage.ts';
import type { LineageGraph, Resource, Theme } from '../types/lineage.ts';

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
  const [project, setProject] = useState<Project | null>(null);
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

  const loadGraph = useCallback((manifest: unknown, catalog: unknown, selectedProject: Project | null = null) => {
    const next = buildLineage(manifest, catalog);
    const first = defaultResource(next);
    setGraph(next); setProject(selectedProject); setRootId(first); setSelectedId(''); setSearch(''); setFilter('all');
    setManifestFile(null); setCatalogFile(null);
    setGraphVersion((version) => version + 1);
    setStatus(''); setError(''); setShowImport(false);
  }, []);

  useEffect(() => {
    if (desktop) return undefined;
    const request = ++requestId.current;
    async function loadLocal() {
      try {
        const [manifestResponse, catalogResponse] = await Promise.all(['/api/artifacts/manifest', '/api/artifacts/catalog'].map((url) => fetch(url)));
        if (!manifestResponse.ok) throw new Error('Could not load target/manifest.json. Generate it with dbt or import it.');
        if (!catalogResponse.ok && catalogResponse.status !== 404) throw new Error(`Could not load target/catalog.json (HTTP ${catalogResponse.status}).`);
        const [manifest, catalog] = await Promise.all([
          manifestResponse.json(),
          catalogResponse.status === 404 ? undefined : catalogResponse.json(),
        ]);
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
    if (!manifestFile) { setError('Choose manifest.json.'); return; }
    const request = ++requestId.current;
    setStatus('Reading selected artifacts…'); setError('');
    try {
      const [manifest, catalog] = await Promise.all([manifestFile.text().then(JSON.parse), catalogFile?.text().then(JSON.parse)]);
      if (request === requestId.current) loadGraph(manifest, catalog);
    } catch (err) {
      if (request === requestId.current) { setError(`Could not import artifacts: ${err instanceof Error ? err.message : String(err)}`); setStatus(''); }
    }
  }

  async function importProject(selectProject: () => Promise<Project | null>) {
    const request = ++requestId.current;
    setStatus('Opening project…'); setError('');
    try {
      const selectedProject = await selectProject();
      if (request !== requestId.current) return;
      if (!selectedProject) { setStatus(''); return; }
      setStatus('Reading project artifacts…');
      const [manifest, catalog] = await loadProjectArtifacts(selectedProject);
      if (request === requestId.current) loadGraph(manifest, catalog, selectedProject);
    } catch (err) {
      if (request === requestId.current) { setError(`Could not open project: ${err instanceof Error ? err.message : String(err)}`); setStatus(''); }
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
  const projectName = graph?.metadata.project_name;
  const readSource = useMemo(() => project
    ? (resource: Resource) => project.readFile(modelPath(resource, projectName))
    : null, [project, projectName]);
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
      <div className="brand"><div className="brand-mark"><GitBranch size={19} /></div><strong>lineage<span>studio</span></strong></div>
      <div className="topbar-divider" />
      <div className="workspace-label"><span className="workspace-icon"><Boxes size={15} /></span><span>{graph?.metadata.project_name || 'dbt project'}</span></div>
      <div className="topbar-spacer" />
      <div className="local-badge"><span className="live-dot" /> Local workspace</div>
      <button className="theme-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>
      <button className="import-button" onClick={() => { setShowImport(true); setError(''); }}><Upload size={15} /> Import artifacts</button>
    </header>

    <div className="app-body">
      <aside className="rail">
        <div className="rail-group"><button className="rail-button" title="Browse resources" onClick={() => setSidebarOpen(true)}><Boxes size={19} /></button></div>
        <div className="rail-bottom"><button className="rail-button" title="About this view" onClick={() => setShowImport(true)}><CircleHelp size={19} /></button></div>
      </aside>
      {sidebarOpen && <aside className="sidebar">
        <div className="sidebar-head"><h2>Explore</h2><button className="icon-button" title="Hide explorer" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={17} /></button></div>
        <label className="search-box"><Search size={16} /><input placeholder="Search resources..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="filter-row"><span><Filter size={13} /> RESOURCE TYPE</span><select aria-label="Filter resource type" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All types</option>{Object.keys(counts).sort().map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
        <div className="list-heading"><span>RESOURCES <span className="count-pill">{matches.length.toLocaleString()}</span></span></div>
        <div className="resource-list">
          {matches.slice(0, 100).map((resource) => <button key={resource.id} className={`resource-item ${rootId === resource.id ? 'active' : ''}`} onClick={() => focus(resource.id)} title={resource.id}>
            <span className={`list-icon ${resource.type}`}><ResourceIcon type={resource.type} size={15} /></span><span className="resource-name"><strong>{resource.name}</strong><small>{resource.schema || resource.packageName || resource.type}</small></span><span className="item-chevron">›</span>
          </button>)}
          {matches.length > 100 && <div className="list-more">Showing 100 of {matches.length.toLocaleString()} resources. Search to narrow results.</div>}
          {graph && matches.length === 0 && <div className="list-more">No matching resources.</div>}
        </div>
      </aside>}
      <main className="main">
        <div className="page-heading">
          <div className="title-row"><div className="title-with-icon"><span className="title-icon"><Network size={20} /></span><h1>Lineage explorer</h1></div><div className="heading-summary"><span><i className="summary-dot model-dot" /> {counts.model?.toLocaleString() || 0} models</span><span><i className="summary-dot source-dot" /> {counts.source?.toLocaleString() || 0} sources</span></div></div>
        </div>
        <div className="graph-card">
          {graph ? <ReactFlowProvider key={graphVersion}><LineageCanvas graph={graph} rootId={rootId} selectedId={selectedId} setSelectedId={setSelectedId} theme={theme}
            renderExport={(context) => <ExportControls {...context} graph={graph} rootId={rootId} theme={theme} />} /></ReactFlowProvider> : <><div className="graph-toolbar"><div className="graph-title"><span className="graph-icon"><GitBranch size={16} /></span><div><strong>Data lineage</strong><small>Select a resource to explore</small></div></div></div><div className="loading-state"><Network size={32} /><strong>{status || 'No artifacts loaded'}</strong><span>{error || 'Preparing your lineage graph'}</span><button onClick={() => setShowImport(true)}>Import artifacts</button></div></>}
          <div className="graph-legend"><span>LEGEND</span><span><i className="legend-icon source"><Database size={12} /></i> Source</span><span><i className="legend-icon model"><Layers2 size={12} /></i> Model</span><span><i className="legend-icon seed"><Table2 size={12} /></i> Seed</span><span><i className="legend-icon exposure"><ArrowUpRight size={12} /></i> Exposure</span><div className="legend-spacer" /><span>Model-level lineage</span></div>
        </div>
      </main>
      {selected && graph && <ResourceDetails resource={selected} graph={graph} rootId={rootId} readSource={readSource}
        onClose={() => setSelectedId('')} onFocus={focus} />}
    </div>
    {showImport && <ImportDialog hasGraph={Boolean(graph)} hasCatalog={Boolean(catalogFile)} error={error} status={status} desktop={desktop}
      onClose={() => { setShowImport(false); setManifestFile(null); setCatalogFile(null); }} onSubmit={importFiles} onManifest={setManifestFile} onCatalog={setCatalogFile}
      onProject={() => { void importProject(chooseDesktopProject); }}
      onProjectFiles={(files) => { void importProject(async () => browserProject(files)); }}
      onUnsupported={() => setError('This browser does not support selecting a folder. Use a supported browser or the desktop app.')} />}
  </div>;
}

