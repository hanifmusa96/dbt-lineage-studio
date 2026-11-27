import { useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ImportDialog } from '../features/artifacts/components/ImportDialog.tsx';
import { useArtifacts } from '../features/artifacts/hooks/useArtifacts.ts';
import { modelPath } from '../features/artifacts/api/project.ts';
import { ExplorerSidebar } from '../features/explorer/components/ExplorerSidebar.tsx';
import { useResourceSearch } from '../features/explorer/hooks/useResourceSearch.ts';
import { ExportControls } from '../features/export/components/ExportControls.tsx';
import { LineageCanvas } from '../features/lineage/components/LineageCanvas.tsx';
import { LineageLegend } from '../features/lineage/components/LineageLegend.tsx';
import { LineagePlaceholder } from '../features/lineage/components/LineagePlaceholder.tsx';
import { ResourceDetails } from '../features/lineage/components/ResourceDetails.tsx';
import { useLineageView } from '../features/lineage/hooks/useLineageView.ts';
import { useTheme } from '../features/theme/useTheme.ts';
import { isDesktop } from '../lib/platform.ts';
import { NavRail } from './components/NavRail.tsx';
import { PageHeading } from './components/PageHeading.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { Resource } from '../types/lineage.ts';
import './app.css';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const view = useLineageView();
  const artifacts = useArtifacts(view.reset);
  const { graph, project } = artifacts;
  const explorer = useResourceSearch(graph);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 600);

  const selected = graph?.resources[view.selectedId];
  const projectName = graph?.metadata.project_name;
  const readSource = useMemo(() => project
    ? (resource: Resource) => project.readFile(modelPath(resource, projectName))
    : null, [project, projectName]);

  return <div className="app" data-theme={theme}>
    <TopBar projectName={projectName} theme={theme} onToggleTheme={toggleTheme} onImport={artifacts.openImport} />
    <div className="app-body">
      <NavRail onBrowse={() => setSidebarOpen(true)} onAbout={artifacts.showImportDialog} />
      {sidebarOpen && <ExplorerSidebar matches={explorer.matches} counts={explorer.counts} search={explorer.search} filter={explorer.filter}
        activeId={view.rootId} hasGraph={Boolean(graph)} onSearch={explorer.setSearch} onFilter={explorer.setFilter}
        onSelect={view.focus} onClose={() => setSidebarOpen(false)} />}
      <main className="main">
        <PageHeading counts={explorer.counts} />
        <div className="graph-card">
          {graph
            ? <ReactFlowProvider key={view.graphVersion}>
              <LineageCanvas graph={graph} rootId={view.rootId} selectedId={view.selectedId} setSelectedId={view.setSelectedId} theme={theme}
                renderExport={(context) => <ExportControls {...context} graph={graph} rootId={view.rootId} theme={theme} />} />
            </ReactFlowProvider>
            : <LineagePlaceholder status={artifacts.status} error={artifacts.error} onImport={artifacts.showImportDialog} />}
          <LineageLegend />
        </div>
      </main>
      {selected && graph && <ResourceDetails resource={selected} graph={graph} rootId={view.rootId} readSource={readSource}
        onClose={() => view.setSelectedId('')} onFocus={view.focus} />}
    </div>
    {artifacts.showImport && <ImportDialog hasGraph={Boolean(graph)} hasCatalog={artifacts.hasCatalog} error={artifacts.error} status={artifacts.status} desktop={isDesktop}
      onClose={artifacts.closeImport} onSubmit={artifacts.importFiles} onManifest={artifacts.setManifestFile} onCatalog={artifacts.setCatalogFile}
      onProject={artifacts.importFolder} onProjectFiles={artifacts.importBrowserFolder}
      onUnsupported={() => artifacts.setError('This browser does not support selecting a folder. Use a supported browser or the desktop app.')} />}
  </div>;
}
