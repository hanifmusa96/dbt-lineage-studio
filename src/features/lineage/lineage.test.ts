import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLineage, getNeighborhood } from './lineage.ts';

const manifest = {
  nodes: {
    'model.p.a': { name: 'a', resource_type: 'model', depends_on: { nodes: ['source.p.s', 'source.p.s'] }, columns: { id: { name: 'id' } } },
    'model.p.b': { name: 'b', resource_type: 'model', depends_on: { nodes: ['model.p.a'] } },
    'test.p.a': { name: 'test', resource_type: 'test', depends_on: { nodes: ['model.p.a'] } },
  },
  sources: { 'source.p.s': { name: 's', resource_type: 'source' } },
};
const catalog = { nodes: { 'model.p.a': { columns: { id: { name: 'id', type: 'int', index: 1 } } } }, sources: {} };

test('builds supported nodes, merges catalog columns, and deduplicates dependencies', () => {
  const graph = buildLineage(manifest, catalog);
  assert.equal(Object.keys(graph.resources).length, 3);
  assert.equal(graph.resources['model.p.a'].columns[0].type, 'int');
  assert.deepEqual(graph.parents['model.p.a'], ['source.p.s']);
  assert.deepEqual(graph.children['model.p.a'], ['model.p.b']);
});

test('expands and folds upstream and downstream independently', () => {
  const graph = buildLineage(manifest, catalog);
  const expanded = { upstream: new Set(['model.p.a']), downstream: new Set(['model.p.a']) };
  assert.equal(getNeighborhood(graph, 'model.p.a', expanded).edges.length, 2);
  expanded.upstream.delete('model.p.a');
  assert.deepEqual(getNeighborhood(graph, 'model.p.a', expanded).ids, ['model.p.a', 'model.p.b']);
  expanded.downstream.delete('model.p.a');
  assert.deepEqual(getNeighborhood(graph, 'model.p.a', expanded).ids, ['model.p.a']);
  expanded.upstream.add('model.p.a');
  expanded.downstream.add('model.p.a');
  assert.equal(getNeighborhood(graph, 'model.p.a', expanded, 2).truncated, true);
});

test('keeps shared branches reachable and restores folded expansions', () => {
  const diamond = buildLineage({ nodes: {
    root: { name: 'root', resource_type: 'model', depends_on: { nodes: [] } },
    left: { name: 'left', resource_type: 'model', depends_on: { nodes: ['root'] } },
    right: { name: 'right', resource_type: 'model', depends_on: { nodes: ['root'] } },
    shared: { name: 'shared', resource_type: 'model', depends_on: { nodes: ['left', 'right'] } },
    end: { name: 'end', resource_type: 'model', depends_on: { nodes: ['shared'] } },
  } }, { nodes: {} });
  const expanded = { upstream: new Set<string>(), downstream: new Set(['root', 'left', 'right', 'shared']) };
  assert.equal(getNeighborhood(diamond, 'root', expanded).ids.length, 5);
  expanded.downstream.delete('left');
  let visible = getNeighborhood(diamond, 'root', expanded);
  assert.equal(visible.ids.length, 5);
  assert.equal(visible.edges.some((edge) => edge.source === 'left' && edge.target === 'shared'), false);
  expanded.downstream.delete('right');
  visible = getNeighborhood(diamond, 'root', expanded);
  assert.deepEqual(visible.ids, ['root', 'left', 'right']);
  expanded.downstream.add('left');
  assert.equal(getNeighborhood(diamond, 'root', expanded).ids.length, 5);
});

test('handles cycles and avoids duplicate edges expanded from both ends', () => {
  const cycle = buildLineage({ nodes: {
    a: { name: 'a', resource_type: 'model', depends_on: { nodes: ['b'] } },
    b: { name: 'b', resource_type: 'model', depends_on: { nodes: ['a'] } },
  } }, { nodes: {} });
  const expanded = { upstream: new Set(['a', 'b']), downstream: new Set(['a', 'b']) };
  const visible = getNeighborhood(cycle, 'a', expanded);
  assert.equal(visible.ids.length, 2);
  assert.equal(visible.edges.length, 2);
});

test('allows expanding beyond four levels', () => {
  const nodes = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [
    `n${i}`, { name: `n${i}`, resource_type: 'model', depends_on: { nodes: i ? [`n${i - 1}`] : [] } },
  ]));
  const graph = buildLineage({ nodes }, { nodes: {} });
  const expanded = { upstream: new Set<string>(), downstream: new Set(['n0', 'n1', 'n2', 'n3', 'n4', 'n5']) };
  assert.equal(getNeighborhood(graph, 'n0', expanded).ids.length, 7);
});

test('rejects invalid artifacts', () => {
  assert.throws(() => buildLineage({}, catalog), /manifest/);
  assert.throws(() => buildLineage(manifest, {}), /catalog/);
});
