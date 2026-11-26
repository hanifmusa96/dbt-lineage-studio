import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutLineage } from './layout.js';

test('routes a fan-out through distinct, spaced ports', async () => {
  const targets = Array.from({ length: 10 }, (_, i) => `target${i}`);
  const layout = await layoutLineage({
    ids: ['root', ...targets],
    edges: targets.map((target) => ({ source: 'root', target })),
  });
  const root = layout.nodes.find((node) => node.id === 'root');
  const outgoing = root.ports.filter((port) => port.type === 'source').sort((a, b) => a.y - b.y);
  assert.equal(outgoing.length, 10);
  assert.ok(root.height > 52);
  for (let i = 1; i < outgoing.length; i++) {
    assert.ok(outgoing[i].y - outgoing[i - 1].y >= 7.9);
  }
  assert.equal(new Set(layout.edges.map((edge) => edge.route.startPoint.y)).size, 10);
  for (const edge of layout.edges) {
    assert.ok(edge.route.startPoint);
    assert.ok(edge.route.endPoint);
  }
});

test('routes crossing dependencies around nodes', async () => {
  const layout = await layoutLineage({
    ids: ['a', 'b', 'c', 'd'],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'd' },
      { source: 'c', target: 'd' },
      { source: 'a', target: 'd' },
    ],
  });
  for (const { route } of layout.edges) {
    const points = [route.startPoint, ...(route.bendPoints || []), route.endPoint];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      assert.ok(a.x === b.x || a.y === b.y);
      for (const node of layout.nodes) {
        const crosses = a.x === b.x
          ? a.x > node.x && a.x < node.x + node.width && Math.max(a.y, b.y) > node.y && Math.min(a.y, b.y) < node.y + node.height
          : a.y > node.y && a.y < node.y + node.height && Math.max(a.x, b.x) > node.x && Math.min(a.x, b.x) < node.x + node.width;
        assert.equal(crosses, false, `Edge crosses ${node.id}`);
      }
    }
  }
});
