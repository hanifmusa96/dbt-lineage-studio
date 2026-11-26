import ELK from 'elkjs/lib/elk.bundled.js';
import type { Neighborhood, Port } from './types.ts';

const elk = new ELK();
const NODE_WIDTH = 200;
const MIN_NODE_HEIGHT = 52;

export async function layoutLineage(neighborhood: Pick<Neighborhood, 'ids' | 'edges'>) {
  const ports = new Map<string, Omit<Port, 'y'>[]>(neighborhood.ids.map((id) => [id, []]));
  const edges = neighborhood.edges.map(({ source, target }, i) => {
    const id = `e${i}`;
    const sourcePort = `${id}-source`;
    const targetPort = `${id}-target`;
    const sourcePorts = ports.get(source);
    const targetPorts = ports.get(target);
    if (!sourcePorts || !targetPorts) throw new Error('An edge references a missing node.');
    sourcePorts.push({ id: sourcePort, type: 'source', side: 'EAST' });
    targetPorts.push({ id: targetPort, type: 'target', side: 'WEST' });
    return { id, source, target, sourcePort, targetPort };
  });
  const layout = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.nodeNode': '42',
      'elk.spacing.edgeNode': '20',
      'elk.spacing.edgeEdge': '16',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: neighborhood.ids.map((id) => {
      const nodePorts = ports.get(id);
      if (!nodePorts) throw new Error('Missing layout ports for a node.');
      const count = Math.max(
        nodePorts.filter((port) => port.type === 'source').length,
        nodePorts.filter((port) => port.type === 'target').length,
      );
      return {
        id, width: NODE_WIDTH, height: Math.max(MIN_NODE_HEIGHT, (count + 1) * 8),
        layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
        ports: nodePorts.map((port) => ({
          id: port.id, width: 0, height: 0, layoutOptions: { 'elk.port.side': port.side },
        })),
      };
    }),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.sourcePort], targets: [edge.targetPort] })),
  });
  if (!layout.children) throw new Error('ELK returned an incomplete graph layout.');
  return {
    nodes: layout.children.map((node) => {
      if (node.x === undefined || node.y === undefined || node.width === undefined || node.height === undefined || !node.ports) {
        throw new Error('ELK returned an incomplete node layout.');
      }
      const { x, y, width, height } = node;
      return {
        id: node.id, x, y, width, height,
        ports: node.ports.map((port) => {
          const definition = ports.get(node.id)?.find((item) => item.id === port.id);
          if (!definition) throw new Error('ELK returned an unknown port.');
          return { ...definition, y: height / 2 };
        }),
      };
    }),
    edges,
  };
}
