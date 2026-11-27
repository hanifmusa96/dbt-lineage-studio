import { invoke } from '@tauri-apps/api/core';
import type { Resource } from '../lineage/types.ts';

export interface Project {
  name: string;
  readFile: (path: string) => Promise<string>;
  hasFile: (path: string) => Promise<boolean>;
}

export function projectPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (!path || normalized.startsWith('/') || parts.some((part) => !part || part === '.' || part === '..' || /[:\0]/.test(part))) {
    throw new Error('The project file path is invalid or outside the selected project.');
  }
  return parts.join('/');
}

export function modelPath(resource: Resource, projectName?: string): string {
  if (!resource.path) throw new Error('The manifest does not contain a source path for this model.');
  if (!projectName || !resource.packageName) throw new Error('The manifest does not identify the project and model package, so the source location cannot be determined.');
  const path = projectPath(resource.path);
  if (projectName && resource.packageName && resource.packageName !== projectName) {
    return projectPath(`dbt_packages/${resource.packageName}/${path}`);
  }
  return path;
}

export function browserProject(files: FileList | File[]): Project {
  const entries = Array.from(files);
  const firstPath = entries[0]?.webkitRelativePath;
  if (!firstPath || !firstPath.includes('/')) throw new Error('Choose a project folder containing dbt artifacts.');
  const name = firstPath.split('/')[0];
  const byPath = new Map<string, File>();
  for (const file of entries) {
    const [root, ...parts] = file.webkitRelativePath.split('/');
    if (root !== name || !parts.length) throw new Error('Choose a single project folder.');
    byPath.set(projectPath(parts.join('/')), file);
  }
  return {
    name,
    async readFile(path) {
      const relative = projectPath(path);
      const file = byPath.get(relative);
      if (!file) throw new Error(`Could not find ${relative} in the selected project.`);
      return file.text();
    },
    async hasFile(path) {
      return byPath.has(projectPath(path));
    },
  };
}

export async function chooseDesktopProject(): Promise<Project | null> {
  const selected = await invoke<[number, string] | null>('choose_project');
  if (!selected) return null;
  const [projectId, name] = selected;
  return {
    name,
    async readFile(path) {
      const bytes = await invoke<ArrayBuffer>('read_project_file', { projectId, path: projectPath(path) });
      return new TextDecoder().decode(bytes);
    },
    async hasFile(path) {
      return invoke<boolean>('project_file_exists', { projectId, path: projectPath(path) });
    },
  };
}

export async function loadProjectArtifacts(project: Project): Promise<[unknown, unknown]> {
  const [manifest, catalog] = await Promise.all([
    project.readFile('target/manifest.json'),
    project.hasFile('target/catalog.json').then((exists) => exists ? project.readFile('target/catalog.json') : undefined),
  ]);
  return [JSON.parse(manifest), catalog === undefined ? undefined : JSON.parse(catalog)];
}
