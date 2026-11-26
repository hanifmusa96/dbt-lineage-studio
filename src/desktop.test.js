import test from 'node:test';
import assert from 'node:assert/strict';
import { saveLineage } from './desktop.js';

test('saves lineage to the selected path and handles cancellation', async () => {
  const calls = [];
  let path = '/chosen/lineage.json';
  globalThis.window = { __TAURI_INTERNALS__: {
    invoke: async (...args) => {
      calls.push(args);
      if (args[0] === 'plugin:dialog|save') return path;
    },
  } };
  try {
    await saveLineage('{"nodes":[]}', 'json', 'json');
    assert.equal(calls[0][0], 'plugin:dialog|save');
    assert.equal(calls[0][1].options.defaultPath, 'lineage.json');
    assert.equal(calls[1][0], 'plugin:fs|write_text_file');
    assert.equal(decodeURIComponent(calls[1][2].headers.path), path);
    assert.equal(new TextDecoder().decode(calls[1][1]), '{"nodes":[]}');

    calls.length = 0;
    path = null;
    await saveLineage('ignored', 'svg', 'svg');
    assert.deepEqual(calls.map(([command]) => command), ['plugin:dialog|save']);
  } finally {
    delete globalThis.window;
  }
});

test('propagates desktop write failures', async () => {
  globalThis.window = { __TAURI_INTERNALS__: {
    invoke: async (command) => {
      if (command === 'plugin:dialog|save') return '/chosen/lineage.svg';
      throw new Error('disk full');
    },
  } };
  try {
    await assert.rejects(saveLineage('svg', 'svg', 'svg'), /disk full/);
  } finally {
    delete globalThis.window;
  }
});
