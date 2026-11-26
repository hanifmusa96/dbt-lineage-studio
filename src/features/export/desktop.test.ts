import test from 'node:test';
import assert from 'node:assert/strict';
import { saveLineage } from './desktop.ts';

test('saves lineage to the selected path and handles cancellation', async () => {
  const calls: string[] = [];
  let path: string | null = '/chosen/lineage.json';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {
    invoke: async (command: string, payload: unknown, options?: { headers: { path: string } }) => {
      calls.push(command);
      if (command === 'plugin:dialog|save') {
        if (path) assert.deepEqual(payload, { options: { defaultPath: 'lineage.json', filters: [{ name: 'JSON', extensions: ['json'] }] } });
        return path;
      }
      assert.equal(command, 'plugin:fs|write_text_file');
      assert.ok(options);
      assert.equal(decodeURIComponent(options.headers.path), path);
      assert.ok(payload instanceof Uint8Array);
      assert.equal(new TextDecoder().decode(payload), '{"nodes":[]}');
    },
  } } });
  try {
    await saveLineage('{"nodes":[]}', 'json', 'json');
    assert.deepEqual(calls, ['plugin:dialog|save', 'plugin:fs|write_text_file']);

    calls.length = 0;
    path = null;
    await saveLineage('ignored', 'svg', 'svg');
    assert.deepEqual(calls, ['plugin:dialog|save']);
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
  }
});

test('propagates desktop write failures', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {
    invoke: async (command: string) => {
      if (command === 'plugin:dialog|save') return '/chosen/lineage.svg';
      throw new Error('disk full');
    },
  } } });
  try {
    await assert.rejects(saveLineage('svg', 'svg', 'svg'), /disk full/);
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
  }
});
