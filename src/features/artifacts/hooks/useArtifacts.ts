import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isDesktop } from '../../../lib/platform.ts';
import { buildLineage } from '../../lineage/utils/lineage.ts';
import { browserProject, chooseDesktopProject, loadProjectArtifacts } from '../api/project.ts';
import type { Project } from '../api/project.ts';
import type { LineageGraph } from '../../../types/lineage.ts';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function fetchLocalArtifacts(): Promise<[unknown, unknown]> {
  const [manifestResponse, catalogResponse] = await Promise.all(['/api/artifacts/manifest', '/api/artifacts/catalog'].map((url) => fetch(url)));
  if (!manifestResponse.ok) throw new Error('Could not load target/manifest.json. Generate it with dbt or import it.');
  if (!catalogResponse.ok && catalogResponse.status !== 404) throw new Error(`Could not load target/catalog.json (HTTP ${catalogResponse.status}).`);
  return Promise.all([
    manifestResponse.json(),
    catalogResponse.status === 404 ? undefined : catalogResponse.json(),
  ]);
}

export function useArtifacts(onLoad: (graph: LineageGraph) => void) {
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState(isDesktop ? '' : 'Loading local dbt artifacts…');
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(isDesktop);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const requestId = useRef(0);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  const loadGraph = useCallback((manifest: unknown, catalog: unknown, selectedProject: Project | null = null) => {
    const next = buildLineage(manifest, catalog);
    setGraph(next); setProject(selectedProject);
    setManifestFile(null); setCatalogFile(null);
    setStatus(''); setError(''); setShowImport(false);
    onLoadRef.current(next);
  }, []);

  useEffect(() => {
    if (isDesktop) return undefined;
    const request = ++requestId.current;
    fetchLocalArtifacts().then(([manifest, catalog]) => {
      if (request === requestId.current) loadGraph(manifest, catalog);
    }).catch((err: unknown) => {
      if (request === requestId.current) { setError(errorMessage(err)); setStatus(''); setShowImport(true); }
    });
    return () => { requestId.current++; };
  }, [loadGraph]);

  async function importFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manifestFile) { setError('Choose manifest.json.'); return; }
    const request = ++requestId.current;
    setStatus('Reading selected artifacts…'); setError('');
    try {
      const [manifest, catalog] = await Promise.all([manifestFile.text().then(JSON.parse), catalogFile?.text().then(JSON.parse)]);
      if (request === requestId.current) loadGraph(manifest, catalog);
    } catch (err) {
      if (request === requestId.current) { setError(`Could not import artifacts: ${errorMessage(err)}`); setStatus(''); }
    }
  }

  async function importProject(selectProject: () => Promise<Project | null>) {
    const request = ++requestId.current;
    setStatus('Opening project…'); setError('');
    try {
      const selectedProject = await selectProject();
      if (request !== requestId.current) return;
      if (!selectedProject) { setStatus(''); return; }
      setStatus('Reading project artifacts…');
      const [manifest, catalog] = await loadProjectArtifacts(selectedProject);
      if (request === requestId.current) loadGraph(manifest, catalog, selectedProject);
    } catch (err) {
      if (request === requestId.current) { setError(`Could not open project: ${errorMessage(err)}`); setStatus(''); }
    }
  }

  return {
    graph, project, status, error, showImport, hasCatalog: Boolean(catalogFile),
    openImport: () => { setShowImport(true); setError(''); },
    showImportDialog: () => setShowImport(true),
    closeImport: () => { setShowImport(false); setManifestFile(null); setCatalogFile(null); },
    setManifestFile, setCatalogFile, setError, importFiles,
    importFolder: () => { void importProject(chooseDesktopProject); },
    importBrowserFolder: (files: FileList) => { void importProject(async () => browserProject(files)); },
  };
}
