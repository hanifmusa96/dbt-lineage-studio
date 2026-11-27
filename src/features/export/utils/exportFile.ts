import type { Edge, Node } from '@xyflow/react';
import type { LineageGraph, Neighborhood } from '../../../types/lineage.ts';
import type { Theme } from '../../theme/useTheme.ts';
import { createExportGraph, exportMermaid, exportSvg } from './export.ts';

export type ExportFormat = 'svg' | 'json' | 'mermaid';

export interface ExportFile { content: string; type: string; extension: string }

export function buildExportFile(format: ExportFormat, context: {
  graph: LineageGraph;
  rootId: string;
  theme: Theme;
  neighborhood: Neighborhood;
  nodes: Pick<Node, 'id' | 'position' | 'measured'>[];
  edges: Pick<Edge, 'id'>[];
  canvas: HTMLElement | null;
}): ExportFile {
  const snapshot = createExportGraph(context.graph, context.rootId, context.neighborhood, context.nodes);
  if (format === 'json') return { content: JSON.stringify(snapshot, null, 2), type: 'application/json', extension: 'json' };
  if (format === 'mermaid') return { content: exportMermaid(snapshot), type: 'text/plain', extension: 'mmd' };
  if (!context.canvas) throw new Error('The graph is not ready to export.');
  const pathElements = new Map(
    [...context.canvas.querySelectorAll('.react-flow__edge')].map((element) => [
      element.getAttribute('data-id'), element.querySelector<SVGPathElement>('.react-flow__edge-path'),
    ]),
  );
  const paths = context.edges.map((edge) => {
    const element = pathElements.get(edge.id);
    const d = element?.getAttribute('d');
    if (!element || !d) throw new Error('Some edges are not ready to export. Please try again.');
    const { x, y, width, height } = element.getBBox();
    return { d, bounds: { x, y, width, height } };
  });
  return { content: exportSvg(snapshot, paths, context.theme), type: 'image/svg+xml', extension: 'svg' };
}
