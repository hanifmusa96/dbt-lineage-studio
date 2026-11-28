import { useState } from 'react';
import type { RefObject } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { Download } from 'lucide-react';
import { isDesktop } from '../../../lib/platform.ts';
import type { LineageGraph, Neighborhood } from '../../../types/lineage.ts';
import type { Theme } from '../../theme/useTheme.ts';
import { downloadInBrowser } from '../api/browser.ts';
import { saveLineage } from '../api/desktop.ts';
import { buildExportFile } from '../utils/exportFile.ts';
import type { ExportFormat } from '../utils/exportFile.ts';
import './ExportControls.css';

export function ExportControls({ graph, rootId, theme, neighborhood, getNodes, edges, canvasRef, ready, onError }: {
  graph: LineageGraph;
  rootId: string;
  theme: Theme;
  neighborhood: Neighborhood;
  getNodes: () => Pick<Node, 'id' | 'position' | 'measured'>[];
  edges: Pick<Edge, 'id'>[];
  canvasRef: RefObject<HTMLDivElement | null>;
  ready: boolean;
  onError: (message: string) => void;
}) {
  const [format, setFormat] = useState<ExportFormat>('svg');
  const [exporting, setExporting] = useState(false);

  const exportLineage = async () => {
    onError('');
    setExporting(true);
    try {
      const { content, type, extension } = buildExportFile(format, {
        graph, rootId, theme, neighborhood, nodes: getNodes(), edges, canvas: canvasRef.current,
      });
      if (isDesktop) await saveLineage(content, extension, format);
      else downloadInBrowser(content, type, `lineage.${extension}`);
    } catch (error) {
      console.error('Lineage export failed:', error);
      onError(`Could not export lineage: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  return <div className="export-controls">
    <select aria-label="Export format" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
      <option value="svg">SVG</option><option value="json">JSON</option><option value="mermaid">Mermaid</option>
    </select>
    <button onClick={exportLineage} disabled={!ready || exporting}><Download size={15} /> Export</button>
  </div>;
}
