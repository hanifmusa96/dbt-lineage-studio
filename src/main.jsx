import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import {
  Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position,
  ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, useUpdateNodeInternals,
} from '@xyflow/react';
import {
  ArrowUpRight, Boxes, ChevronDown, CircleHelp,
  Database, Download, FileJson, Filter, GitBranch, Layers2, Map as MapIcon, Maximize2, Moon, Network, PanelLeftClose,
  Search, Sun, Table2, Upload, X,
} from 'lucide-react';
import { buildLineage, defaultResource, getNeighborhood } from './lineage.js';
import { saveLineage } from './desktop.js';
import { createExportGraph, exportMermaid, exportSvg } from './export.js';
import { layoutLineage } from './layout.js';
import '@xyflow/react/dist/style.css';
import './styles.css';

function ResourceIcon({ type, size = 16 }) {
  if (type === 'source') return <Database size={size} />;
  if (type === 'exposure') return <ArrowUpRight size={size} />;
  if (type === 'seed') return <Table2 size={size} />;
  return <Layers2 size={size} />;
}

function ResourceNode({ id, data, selected }) {
  const { resource, isRoot, upstreamCount, downstreamCount, expanded, onToggle, ports } = data;
  const tooltipId = useId();
  const [tooltip, setTooltip] = useState(null);
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => { updateNodeInternals(id); }, [id, ports, updateNodeInternals]);
  useEffect(() => {
    if (!tooltip) return;
    const hide = () => setTooltip(null);
    window.addEventListener('wheel', hide, { passive: true });
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('wheel', hide);
      window.removeEventListener('resize', hide);
    };
  }, [tooltip]);
  const showTooltip = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const above = rect.top > window.innerHeight / 2;
    setTooltip({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
  };
  const control = (direction, count) => count > 0 && (
    <button
      className={`branch-control branch-${direction} nodrag nopan`}
      aria-label={`${expanded[direction] ? 'Collapse' : 'Expand'} ${direction} of ${resource.name}`}
      aria-expanded={expanded[direction]}
      title={`${expanded[direction] ? 'Collapse' : 'Expand'} ${count} ${direction} ${count === 1 ? 'resource' : 'resources'}`}
      onClick={(event) => { event.stopPropagation(); onToggle(resource.id, direction); }}
    >{expanded[direction] ? '−' : '+'}</button>
  );
  return (
    <div className={`graph-node ${selected ? 'node-selected' : ''} ${isRoot ? 'node-root' : ''}`}>
      {ports.map((port) => <Handle key={port.id} id={port.id} type={port.type}
        position={port.type === 'target' ? Position.Left : Position.Right}
        style={{ top: port.y }} />)}
      {control('upstream', upstreamCount)}
      <div className="node-top">
        <span className={`type-icon ${resource.type}`} title={resource.type}><ResourceIcon type={resource.type} size={14} /></span>
        <div className="node-heading">
          <strong tabIndex={0} aria-describedby={tooltip ? tooltipId : undefined}
            onMouseEnter={showTooltip} onMouseLeave={() => setTooltip(null)}
            onFocus={showTooltip} onBlur={() => setTooltip(null)}
            onPointerDown={() => setTooltip(null)}
            onKeyDown={(event) => { if (event.key === 'Escape') setTooltip(null); }}>
            {resource.name}
          </strong>
          {resource.materialization && <span title={resource.materialization}>{resource.materialization}</span>}
        </div>
      </div>
      {control('downstream', downstreamCount)}
      {tooltip && createPortal(
        <div id={tooltipId} role="tooltip" className="node-name-tooltip"
          style={{ left: tooltip.left, top: tooltip.top, transform: tooltip.above ? 'translateY(-100%)' : undefined }}>
          {resource.name}
        </div>,
        document.body,
      )}
    </div>
  );
}
const nodeTypes = { resource: ResourceNode };
const desktop = isTauri();
const minimapNodeColor = (node) => {
  if (node.data.isRoot) return '#8183ef';
  return { source: '#43b696', seed: '#d99b4c', exposure: '#d77f9d' }[node.data.resource.type] || '#a3a8c1';
};

function Canvas({ graph, rootId, selectedId, setSelectedId, theme }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useState([]);
  const [layoutError, setLayoutError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportFormat, setExportFormat] = useState('svg');
  const [exporting, setExporting] = useState(false);
  const [layingOut, setLayingOut] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [expanded, setExpanded] = useState(() => ({
    upstream: new Set([rootId]),
    downstream: new Set([rootId]),
  }));
  const selectedRef = useRef(selectedId);
  const canvasRef = useRef(null);
  selectedRef.current = selectedId;
  const toggleBranch = useCallback((id, direction) => {
    setExpanded((current) => {
      const branch = new Set(current[direction]);
      if (branch.has(id)) branch.delete(id);
      else branch.add(id);
      return { ...current, [direction]: branch };
    });
  }, []);
  const { fitView, getNodes } = useReactFlow();
  const neighborhood = useMemo(() => getNeighborhood(graph, rootId, expanded), [graph, rootId, expanded]);
  const readyToExport = !layingOut && !layoutError && neighborhood.ids.length > 0 &&
    nodes.length === neighborhood.ids.length && edges.length === neighborhood.edges.length &&
    neighborhood.ids.every((id) => nodes.some((node) => node.id === id)) &&
    neighborhood.edges.every(({ source, target }) => edges.some((edge) => edge.source === source && edge.target === target));

  const exportLineage = async () => {
    setExportError('');
    setExporting(true);
    try {
      const snapshot = createExportGraph(graph, rootId, neighborhood, getNodes());
      let content;
      let type;
      let extension;
      if (exportFormat === 'json') {
        content = JSON.stringify(snapshot, null, 2);
        type = 'application/json';
        extension = 'json';
      } else if (exportFormat === 'mermaid') {
        content = exportMermaid(snapshot);
        type = 'text/plain';
        extension = 'mmd';
      } else {
        const pathElements = new Map(
          [...canvasRef.current.querySelectorAll('.react-flow__edge')].map((element) => [
            element.getAttribute('data-id'), element.querySelector('.react-flow__edge-path'),
          ]),
        );
        const paths = edges.map((edge) => {
          const element = pathElements.get(edge.id);
          if (!element || !element.getAttribute('d')) throw new Error('Some edges are not ready to export. Please try again.');
          const { x, y, width, height } = element.getBBox();
          return { d: element.getAttribute('d'), bounds: { x, y, width, height } };
        });
        content = exportSvg(snapshot, paths, theme);
        type = 'image/svg+xml';
        extension = 'svg';
      }
      if (desktop) {
        await saveLineage(content, extension, exportFormat);
      } else {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `lineage.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      console.error('Lineage export failed:', error);
      setExportError(`Could not export lineage: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!rootId) { setNodes([]); setEdges([]); return; }
    setLayingOut(true);
    setLayoutError('');
    layoutLineage(neighborhood).then((layout) => {
      if (!active) return;
      setNodes(layout.nodes.map((node) => ({
        id: node.id, type: 'resource', position: { x: node.x, y: node.y },
        style: { width: node.width, height: node.height },
        selected: node.id === selectedRef.current,
        data: {
          resource: graph.resources[node.id], isRoot: node.id === rootId,
          upstreamCount: graph.parents[node.id].length, downstreamCount: graph.children[node.id].length,
          expanded: { upstream: expanded.upstream.has(node.id), downstream: expanded.downstream.has(node.id) },
          onToggle: toggleBranch, ports: node.ports,
        },
      })));
      setEdges(layout.edges.map(({ id, source, target, sourcePort, targetPort }) => ({
        id, source, target, sourceHandle: sourcePort, targetHandle: targetPort, type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#7d8fa8' },
        style: { stroke: '#7d8fa8', strokeWidth: 1.8 },
      })));
      setLayingOut(false);
      requestAnimationFrame(() => fitView({ padding: 0.22, maxZoom: 1, duration: 350 }));
    }).catch((error) => {
      if (active) { setLayoutError(`Could not lay out the graph: ${error.message}`); setLayingOut(false); }
    });
    return () => { active = false; };
  }, [graph, rootId, neighborhood, expanded, setNodes, fitView, toggleBranch]);

  useEffect(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === selectedId })));
  }, [selectedId, setNodes]);

  return (
    <>
    <div className="graph-toolbar">
      <div className="graph-title"><span className="graph-icon"><GitBranch size={16} /></span><div><strong>Data lineage</strong><small>{rootId ? `Exploring ${graph.resources[rootId].name}` : 'Select a resource to explore'}</small></div></div>
      <div className="export-controls">
        <select aria-label="Export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
          <option value="svg">SVG</option><option value="json">JSON</option><option value="mermaid">Mermaid</option>
        </select>
        <button onClick={exportLineage} disabled={!readyToExport || exporting}><Download size={15} /> Export</button>
      </div>
    </div>
    <div className="canvas" ref={canvasRef}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
        onNodeClick={(_, node) => setSelectedId(node.id)} nodesConnectable={false}
        minZoom={0.05} maxZoom={1.8} colorMode={theme}>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color={theme === 'dark' ? '#34445a' : '#dce2e9'} />
        <Controls showInteractive={false} position="bottom-left" />
        {rootId && showMinimap && <MiniMap ariaLabel="Lineage minimap" pannable zoomable nodeColor={minimapNodeColor}
          bgColor={theme === 'dark' ? '#1b273a' : '#ffffff'}
          maskColor={theme === 'dark' ? '#0d1523a6' : '#e5e9f080'}
          maskStrokeColor={theme === 'dark' ? '#a5b2c6' : '#8493aa'} maskStrokeWidth={2} />}
      </ReactFlow>
      <div className="canvas-overlay"><span className="live-dot" /> INTERACTIVE LINEAGE <span className="overlay-divider" /> {neighborhood.ids.length} nodes <span>·</span> {neighborhood.edges.length} connections</div>
      {(layingOut || layoutError || exportError || neighborhood.truncated) && <div role={layoutError || exportError ? 'alert' : undefined} className={`canvas-notice ${layoutError || exportError ? 'error' : ''}`}>
        {layoutError || exportError || (layingOut ? 'Arranging your lineage…' : 'Graph limited to 100 nodes. Select a closer resource to explore more.')}
      </div>}
      {!rootId && <div className="empty-canvas"><Network size={30} /><strong>No resources found</strong><span>Load a manifest containing supported dbt resources.</span></div>}
      {rootId && <button className="minimap-toggle" aria-label={`${showMinimap ? 'Hide' : 'Show'} minimap`}
        aria-pressed={showMinimap} title={`${showMinimap ? 'Hide' : 'Show'} minimap`}
        onClick={() => setShowMinimap((current) => !current)}><MapIcon size={16} /></button>}
      <div className="canvas-hint">Scroll to zoom <span>·</span> Drag to pan</div>
      <button className="fit-button" onClick={() => fitView({ padding: 0.22, maxZoom: 1, duration: 350 })} title="Fit graph" aria-label="Fit graph"><Maximize2 size={16} /></button>
    </div>
    </>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('lineage-theme') === 'dark' ? 'dark' : 'light';
    } catch (error) {
      console.warn('Could not read the saved theme preference:', error);
      return 'light';
    }
  });
  const [graph, setGraph] = useState(null);
  const [rootId, setRootId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [graphVersion, setGraphVersion] = useState(0);
  const [status, setStatus] = useState(desktop ? '' : 'Loading local dbt artifacts…');
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(desktop);
  const [manifestFile, setManifestFile] = useState(null);
  const [catalogFile, setCatalogFile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 600);
  const requestId = useRef(0);

  const loadGraph = useCallback((manifest, catalog) => {
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
        if (request === requestId.current) { setError(err.message); setStatus(''); setShowImport(true); }
      }
    }
    loadLocal();
    return () => { requestId.current++; };
  }, [loadGraph]);

  async function importFiles(event) {
    event.preventDefault();
    if (!manifestFile || !catalogFile) { setError('Choose both manifest.json and catalog.json.'); return; }
    const request = ++requestId.current;
    setStatus('Reading selected artifacts…'); setError('');
    try {
      const [manifest, catalog] = await Promise.all([manifestFile.text().then(JSON.parse), catalogFile.text().then(JSON.parse)]);
      if (request === requestId.current) loadGraph(manifest, catalog);
    } catch (err) {
      if (request === requestId.current) { setError(`Could not import artifacts: ${err.message}`); setStatus(''); }
    }
  }

  const resources = useMemo(() => graph ? Object.values(graph.resources) : [], [graph]);
  const counts = useMemo(() => resources.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc; }, {}), [resources]);
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return resources.filter((item) => (filter === 'all' || item.type === filter) &&
      (!query || [item.name, item.schema, item.packageName, item.sourceName, item.id].some((value) => value.toLowerCase().includes(query))));
  }, [resources, search, filter]);
  const selected = graph?.resources[selectedId];
  const focus = (id) => { setRootId(id); setSelectedId(''); setGraphVersion((version) => version + 1); };
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
          {graph ? <ReactFlowProvider key={graphVersion}><Canvas graph={graph} rootId={rootId} selectedId={selectedId} setSelectedId={setSelectedId} theme={theme} /></ReactFlowProvider> : <><div className="graph-toolbar"><div className="graph-title"><span className="graph-icon"><GitBranch size={16} /></span><div><strong>Data lineage</strong><small>Select a resource to explore</small></div></div></div><div className="loading-state"><Network size={32} /><strong>{status || 'No artifacts loaded'}</strong><span>{error || 'Preparing your lineage graph'}</span><button onClick={() => setShowImport(true)}>Import artifacts</button></div></>}
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
    {showImport && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && graph) setShowImport(false); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="modal-head"><span className="title-icon"><FileJson size={19} /></span>{graph && <button className="icon-button" onClick={() => setShowImport(false)} aria-label="Close import dialog"><X size={18} /></button>}</div>
      <h2 id="import-title">Bring your lineage to life</h2><p>Choose your dbt artifacts to explore your project's dependencies. Files are read locally on your device.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <form onSubmit={importFiles}><label className="file-label">Manifest <span>Required</span><input type="file" accept=".json,application/json" onChange={(event) => setManifestFile(event.target.files[0] || null)} /></label><label className="file-label">Catalog <span>Required</span><input type="file" accept=".json,application/json" onChange={(event) => setCatalogFile(event.target.files[0] || null)} /></label><button className="submit-button" type="submit" disabled={Boolean(status)}>{status || 'Explore lineage'} <ArrowUpRight size={16} /></button></form>
      <small>Generate artifacts with <code>dbt compile</code> and <code>dbt docs generate</code>.</small>
    </div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
