import type { Node } from '@xyflow/react';
import type { LineageGraph, Neighborhood, Resource } from '../../../types/lineage.ts';
import type { Theme } from '../../theme/useTheme.ts';

type ExportNode = Omit<Resource, 'dependencies'> & {
  position: { x: number; y: number };
  size: { width: number; height: number };
};
export interface ExportGraph {
  version: number;
  rootId: string;
  truncated: boolean;
  nodes: ExportNode[];
  edges: Neighborhood['edges'];
}
export interface ExportPath {
  d: string;
  bounds: { x: number; y: number; width: number; height: number };
}

function escapeXml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  };
  return String(value).replace(/[&<>"']/g, (char) => entities[char]);
}

function escapeMermaid(value: string) {
  return String(value).replace(/[&#"<>\\\r\n]/g, (char) => `#${char.codePointAt(0)};`);
}

export function createExportGraph(graph: Pick<LineageGraph, 'resources'>, rootId: string, neighborhood: Neighborhood, nodes: Pick<Node, 'id' | 'position' | 'measured'>[]): ExportGraph {
  const positions = new Map(nodes.map((node) => [node.id, node]));
  const resources = neighborhood.ids.map((id) => {
    const node = positions.get(id);
    if (!node || !node.measured?.width || !node.measured?.height) {
      throw new Error('The graph is still being laid out. Please try again.');
    }
    const { dependencies, ...resource } = graph.resources[id];
    return {
      ...resource,
      position: { x: node.position.x, y: node.position.y },
      size: { width: node.measured.width, height: node.measured.height },
    };
  });
  return {
    version: 1,
    rootId,
    truncated: neighborhood.truncated,
    nodes: resources,
    edges: neighborhood.edges.map(({ source, target }) => ({ source, target })),
  };
}

export function exportMermaid(snapshot: ExportGraph) {
  const ids = new Map(snapshot.nodes.map((node, i) => [node.id, `n${i}`]));
  const lines = ['flowchart LR'];
  if (snapshot.truncated) lines.push('    %% This graph is truncated at 100 nodes.');
  for (const node of snapshot.nodes) {
    lines.push(`    ${ids.get(node.id)}["${escapeMermaid(node.name)}"]`);
  }
  for (const edge of snapshot.edges) {
    lines.push(`    ${ids.get(edge.source)} --> ${ids.get(edge.target)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function exportSvg(snapshot: ExportGraph, paths: ExportPath[], theme: Theme) {
  if (paths.length !== snapshot.edges.length) {
    throw new Error('Some edges are not ready to export. Please try again.');
  }
  const dark = theme === 'dark';
  const colors = dark
    ? { background: '#111b2b', node: '#233147', border: '#43536b', text: '#e8eef8', muted: '#a7b5c8', icon: '#34365e', iconText: '#c0c3ff' }
    : { background: '#fcfdff', node: '#ffffff', border: '#e4e8f0', text: '#334054', muted: '#6f7a8a', icon: '#eeeeff', iconText: '#7779df' };
  const boxes = [
    ...snapshot.nodes.map((node) => ({ ...node.position, ...node.size })),
    ...paths.map((path) => path.bounds),
  ];
  const padding = 32;
  const left = Math.floor(Math.min(...boxes.map((box) => box.x)) - padding);
  const top = Math.floor(Math.min(...boxes.map((box) => box.y)) - padding);
  const right = Math.ceil(Math.max(...boxes.map((box) => box.x + box.width)) + padding);
  const bottom = Math.ceil(Math.max(...boxes.map((box) => box.y + box.height)) + padding);
  const nodes = snapshot.nodes.map((node, i) => {
    const { x, y } = node.position;
    const { width, height } = node.size;
    const centerY = y + height / 2;
    const typeColors: Record<string, string[]> = {
      source: dark ? ['#173c36', '#75ddbd'] : ['#e7f8f2', '#26a98a'],
      seed: dark ? ['#493922', '#f1c379'] : ['#fff5e7', '#d79542'],
      exposure: dark ? ['#482c3d', '#f0a2be'] : ['#fff0f4', '#d97799'],
    };
    const [icon, iconText] = typeColors[node.type] || [colors.icon, colors.iconText];
    const nameY = node.materialization ? centerY - 4 : centerY + 4;
    const materialization = node.materialization
      ? `<text x="${x + 46}" y="${centerY + 12}" font-size="10" fill="${colors.muted}" clip-path="url(#clip${i})">${escapeXml(node.materialization)}</text>`
      : '';
    return `<g><title>${escapeXml(node.name)}</title><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${colors.node}" stroke="${node.id === snapshot.rootId ? '#888af0' : colors.border}"${node.id === snapshot.rootId ? ' stroke-width="2"' : ''}/><rect x="${x + 10}" y="${centerY - 14}" width="28" height="28" rx="8" fill="${icon}"/><text x="${x + 24}" y="${centerY + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${iconText}">${escapeXml(node.type.charAt(0).toUpperCase())}</text><clipPath id="clip${i}"><rect x="${x + 46}" y="${y}" width="${Math.max(0, width - 56)}" height="${height}"/></clipPath><text x="${x + 46}" y="${nameY}" font-size="11" font-weight="700" fill="${colors.text}" clip-path="url(#clip${i})">${escapeXml(node.name)}</text>${materialization}</g>`;
  }).join('');
  const edges = paths.map((path) => `<path d="${escapeXml(path.d)}" fill="none" stroke="#7d8fa8" stroke-width="1.8" marker-end="url(#arrow)"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${right - left}" height="${bottom - top}" viewBox="${left} ${top} ${right - left} ${bottom - top}" role="img"><title>dbt lineage</title><desc>${snapshot.truncated ? 'Visible lineage truncated at 100 nodes.' : 'Visible dbt resource lineage.'}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7d8fa8"/></marker></defs><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="${colors.background}"/><g font-family="system-ui, -apple-system, sans-serif">${edges}${nodes}</g></svg>`;
}
