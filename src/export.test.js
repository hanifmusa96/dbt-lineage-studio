import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportGraph, exportMermaid, exportSvg } from './export.js';

const graph = { resources: {
  a: { id: 'a', name: 'model "quoted" #1', type: 'model', materialization: 'view', columns: [{ name: 'id' }], dependencies: ['hidden'] },
  b: { id: 'b', name: '<source & name>', type: 'source', materialization: '', columns: [], dependencies: [] },
} };
const neighborhood = { ids: ['a', 'b'], edges: [{ source: 'b', target: 'a' }], truncated: true };
const nodes = [
  { id: 'a', position: { x: 100, y: 80 }, measured: { width: 200, height: 52 } },
  { id: 'b', position: { x: -180, y: 10 }, measured: { width: 200, height: 52 } },
];

test('exports only the visible resources and connections with current positions', () => {
  const snapshot = createExportGraph(graph, 'a', neighborhood, nodes);
  assert.equal(snapshot.rootId, 'a');
  assert.equal(snapshot.truncated, true);
  assert.deepEqual(snapshot.edges, [{ source: 'b', target: 'a' }]);
  assert.deepEqual(snapshot.nodes[0].position, { x: 100, y: 80 });
  assert.deepEqual(snapshot.nodes[0].columns, [{ name: 'id' }]);
  assert.equal('dependencies' in snapshot.nodes[0], false);
  assert.throws(() => createExportGraph(graph, 'a', neighborhood, nodes.slice(0, 1)), /laid out/);
});

test('generates Mermaid with safe identifiers, escaped names, and isolated nodes', () => {
  const snapshot = createExportGraph(graph, 'a', neighborhood, nodes);
  const text = exportMermaid(snapshot);
  assert.match(text, /^flowchart LR\n/);
  assert.match(text, /n0\["model #34;quoted#34; #35;1"\]/);
  assert.match(text, /n1\["#60;source #38; name#62;"\]/);
  assert.match(text, /n1 --> n0/);
  assert.match(text, /truncated/);
  assert.doesNotMatch(exportMermaid({ ...snapshot, edges: [] }), /-->/);
});

test('generates standalone SVG with escaped names and space for edge bounds', () => {
  const snapshot = createExportGraph(graph, 'a', neighborhood, nodes);
  const paths = [{ d: 'M20,36 C60,-70 60,106 100,106', bounds: { x: 20, y: -70, width: 80, height: 176 } }];
  const svg = exportSvg(snapshot, paths, 'dark');
  assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /viewBox="-212 -102 544 266"/);
  assert.match(svg, /&lt;source &amp; name&gt;/);
  assert.match(svg, /model &quot;quoted&quot; #1/);
  assert.match(svg, /C60,-70/);
  assert.match(svg, /truncated at 100 nodes/);
  assert.throws(() => exportSvg(snapshot, [], 'light'), /edges are not ready/);
});
