import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();
const NODE_WIDTH = 200;
const MIN_NODE_HEIGHT = 52;

export async function layoutLineage(neighborhood) {
  const ports = new Map(neighborhood.ids.map((id) => [id, []]));
  const edges = neighborhood.edges.map(({ source, target }, i) => {
    const id = `e${i}`;
    const sourcePort = `${id}-source`;
    const targetPort = `${id}-target`;
    ports.get(source).push({ id: sourcePort, type: 'source', side: 'EAST' });
    ports.get(target).push({ id: targetPort, type: 'target', side: 'WEST' });
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
  const laidOutEdges = new Map(layout.edges.map((edge) => [edge.id, edge]));
  return {
    nodes: layout.children.map((node) => ({
      id: node.id, x: node.x, y: node.y, width: node.width, height: node.height,
      ports: node.ports.map((port) => ({
        ...ports.get(node.id).find((item) => item.id === port.id), y: port.y,
      })),
    })),
    edges: edges.map((edge) => {
      const sections = laidOutEdges.get(edge.id)?.sections;
      if (!sections || sections.length !== 1) throw new Error(`Missing route for edge ${edge.id}`);
      return { ...edge, route: sections[0] };
    }),
  };
}
