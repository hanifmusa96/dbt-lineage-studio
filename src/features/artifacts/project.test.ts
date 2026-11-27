import test from 'node:test';
import assert from 'node:assert/strict';
import { browserProject, chooseDesktopProject, loadProjectArtifacts, modelPath, projectPath } from './project.ts';
import type { Resource } from '../lineage/types.ts';

function projectFile(path: string, content: string): File {
  const file = new File([content], path.split('/').at(-1)!);
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

test('reads project artifacts and model files from a browser folder selection', async () => {
  const project = browserProject([
    projectFile('my-project/target/manifest.json', '{"metadata":{"project_name":"my_project"}}'),
    projectFile('my-project/target/catalog.json', '{"nodes":{}}'),
    projectFile('my-project/models/orders.sql', 'select 1'),
  ]);
  assert.equal(project.name, 'my-project');
  assert.deepEqual(await loadProjectArtifacts(project), [{ metadata: { project_name: 'my_project' } }, { nodes: {} }]);
  assert.equal(await project.readFile('models/orders.sql'), 'select 1');
  await assert.rejects(project.readFile('models/missing.sql'), /Could not find models\/missing.sql/);
});

test('reports missing artifacts, invalid JSON, and invalid folder selections', async () => {
  await assert.rejects(loadProjectArtifacts(browserProject([projectFile('project/target/manifest.json', '{}')])), /target\/catalog.json/);
  await assert.rejects(loadProjectArtifacts(browserProject([
    projectFile('project/target/manifest.json', '{'),
    projectFile('project/target/catalog.json', '{}'),
  ])), SyntaxError);
  assert.throws(() => browserProject([new File([''], 'manifest.json')]), /project folder/);
  assert.throws(() => browserProject([projectFile('one/a', ''), projectFile('two/b', '')]), /single project folder/);
});

test('rejects unsafe paths and resolves main-project and dependency models', () => {
  for (const path of ['../secret', 'models/../secret', '/absolute', 'C:\\secret', '\\\\server\\share', 'a//b', 'a\0b']) {
    assert.throws(() => projectPath(path), /invalid or outside/);
  }
  const model: Resource = {
    id: 'model.main.orders', name: 'orders', type: 'model', schema: '', database: '',
    packageName: 'main', sourceName: '', description: '', materialization: '',
    path: 'models\\orders.sql', columns: [], dependencies: [],
  };
  assert.equal(modelPath(model, 'main'), 'models/orders.sql');
  assert.equal(modelPath({ ...model, packageName: 'other' }, 'main'), 'dbt_packages/other/models/orders.sql');
  assert.throws(() => modelPath({ ...model, packageName: '../other' }, 'main'), /invalid or outside/);
  assert.throws(() => modelPath({ ...model, path: '' }, 'main'), /source path/);
  assert.throws(() => modelPath(model), /cannot be determined/);
});

test('desktop selection reads only through the project commands and propagates errors', async () => {
  const calls: string[] = [];
  let cancel = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {
    invoke: async (command: string, payload?: { projectId: number; path: string }) => {
      calls.push(command);
      if (command === 'choose_project') return cancel ? null : [7, '/chosen/project'];
      if (payload?.path === 'models/missing.sql') throw new Error('read failed');
      assert.deepEqual(payload, { projectId: 7, path: 'models/orders.sql' });
      return new TextEncoder().encode('select 1').buffer;
    },
  } } });
  try {
    const project = await chooseDesktopProject();
    assert.ok(project);
    assert.equal(await project.readFile('models/orders.sql'), 'select 1');
    await assert.rejects(project.readFile('models/missing.sql'), /read failed/);
    await assert.rejects(project.readFile('../secret'), /invalid or outside/);
    cancel = true;
    assert.equal(await chooseDesktopProject(), null);
    assert.deepEqual(calls, ['choose_project', 'read_project_file', 'read_project_file', 'choose_project']);
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
  }
});
