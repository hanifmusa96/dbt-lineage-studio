import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Dispatch, MouseEvent, FocusEvent, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { isTauri } from '@tauri-apps/api/core';
import {
  Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position,
  ReactFlow, useNodesState, useReactFlow, useUpdateNodeInternals,
} from '@xyflow/react';
import type { Edge, NodeProps } from '@xyflow/react';
import { Download, GitBranch, Map as MapIcon, Maximize2, Network } from 'lucide-react';
import { createExportGraph, exportMermaid, exportSvg } from '../export/export.ts';
import { saveLineage } from '../export/desktop.ts';
import { layoutLineage } from './layout.ts';
import { getNeighborhood } from './lineage.ts';
import { ResourceIcon } from './ResourceIcon.tsx';
import type { Direction, LineageGraph, ResourceFlowNode, Theme } from './types.ts';

function ResourceNode({ id, data, selected }: NodeProps<ResourceFlowNode>) {
  const { resource, isRoot, upstreamCount, downstreamCount, expanded, onToggle, ports } = data;
  const tooltipId = useId();
  const [tooltip, setTooltip] = useState<{ left: number; top: number; above: boolean } | null>(null);
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
  const showTooltip = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const above = rect.top > window.innerHeight / 2;
    setTooltip({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
  };
  const control = (direction: Direction, count: number) => count > 0 && (
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
const minimapNodeColor = (node: ResourceFlowNode) => {
  if (node.data.isRoot) return '#8183ef';
  const colors: Record<string, string> = { source: '#43b696', seed: '#d99b4c', exposure: '#d77f9d' };
  return colors[node.data.resource.type] || '#a3a8c1';
};

export function LineageCanvas({ graph, rootId, selectedId, setSelectedId, theme }: {
  graph: LineageGraph; rootId: string; selectedId: string; setSelectedId: Dispatch<SetStateAction<string>>; theme: Theme;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ResourceFlowNode>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
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
  const canvasRef = useRef<HTMLDivElement>(null);
  selectedRef.current = selectedId;
  const toggleBranch = useCallback((id: string, direction: Direction) => {
    setExpanded((current) => {
      const branch = new Set(current[direction]);
      if (branch.has(id)) branch.delete(id);
      else branch.add(id);
      return { ...current, [direction]: branch };
    });
  }, []);
  const { fitView, getNodes } = useReactFlow<ResourceFlowNode>();
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
        if (!canvasRef.current) throw new Error('The graph is not ready to export.');
        const pathElements = new Map(
          [...canvasRef.current.querySelectorAll('.react-flow__edge')].map((element) => [
            element.getAttribute('data-id'), element.querySelector<SVGPathElement>('.react-flow__edge-path'),
          ]),
        );
        const paths = edges.map((edge) => {
          const element = pathElements.get(edge.id);
          const d = element?.getAttribute('d');
          if (!element || !d) throw new Error('Some edges are not ready to export. Please try again.');
          const { x, y, width, height } = element.getBBox();
          return { d, bounds: { x, y, width, height } };
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
    }).catch((error: unknown) => {
      if (active) { setLayoutError(`Could not lay out the graph: ${error instanceof Error ? error.message : String(error)}`); setLayingOut(false); }
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

