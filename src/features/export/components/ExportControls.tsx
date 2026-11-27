import { useState } from 'react';
import type { RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import type { Edge, Node } from '@xyflow/react';
import { Download } from 'lucide-react';
import type { LineageGraph, Neighborhood, Theme } from '../../../types/lineage.ts';
import { saveLineage } from '../api/desktop.ts';
import { createExportGraph, exportMermaid, exportSvg } from '../utils/export.ts';

const desktop = isTauri();

export function ExportControls({ graph, rootId, theme, neighborhood, getNodes, edges, canvasRef, ready, onError }: {
  graph: LineageGraph;
  rootId: string;
  theme: Theme;
  neighborhood: Neighborhood;
  getNodes: () => Pick<Node, 'id' | 'position' | 'measured'>[];
  edges: Pick<Edge, 'id'>[];
  canvasRef: RefObject<HTMLDivElement>;
  ready: boolean;
  onError: (message: string) => void;
}) {
  const [exportFormat, setExportFormat] = useState('svg');
  const [exporting, setExporting] = useState(false);

  const exportLineage = async () => {
    onError('');
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
      onError(`Could not export lineage: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  return <div className="export-controls">
    <select aria-label="Export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
      <option value="svg">SVG</option><option value="json">JSON</option><option value="mermaid">Mermaid</option>
    </select>
    <button onClick={exportLineage} disabled={!ready || exporting}><Download size={15} /> Export</button>
  </div>;
}
