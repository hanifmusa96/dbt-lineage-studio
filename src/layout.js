import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();
const NODE_WIDTH = 200;
const MIN_NODE_HEIGHT = 52;

export function bezierRoute({ startPoint, endPoint, bendPoints = [] }) {
  const points = [startPoint, ...bendPoints, endPoint]
    .filter((point, i, all) => i === 0 || point.x !== all[i - 1].x || point.y !== all[i - 1].y);
  const path = [`M ${startPoint.x} ${startPoint.y}`];
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(20, incoming / 2, outgoing / 2);
    const before = {
      x: corner.x + (previous.x - corner.x) * radius / incoming,
      y: corner.y + (previous.y - corner.y) * radius / incoming,
    };
    const after = {
      x: corner.x + (next.x - corner.x) * radius / outgoing,
      y: corner.y + (next.y - corner.y) * radius / outgoing,
    };
    const control1 = { x: before.x + (corner.x - before.x) * 2 / 3, y: before.y + (corner.y - before.y) * 2 / 3 };
    const control2 = { x: after.x + (corner.x - after.x) * 2 / 3, y: after.y + (corner.y - after.y) * 2 / 3 };
    path.push(`L ${before.x} ${before.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${after.x} ${after.y}`);
  }
  path.push(`L ${endPoint.x} ${endPoint.y}`);
  return path.join(' ');
}

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
