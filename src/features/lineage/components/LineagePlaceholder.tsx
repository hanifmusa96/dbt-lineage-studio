import { GitBranch, Network } from 'lucide-react';

export function LineagePlaceholder({ status, error, onImport }: { status: string; error: string; onImport: () => void }) {
  return <>
    <div className="graph-toolbar">
      <div className="graph-title">
        <span className="graph-icon"><GitBranch size={16} /></span>
        <div><strong>Data lineage</strong><small>Select a resource to explore</small></div>
      </div>
    </div>
    <div className="loading-state">
      <Network size={32} />
      <strong>{status || 'No artifacts loaded'}</strong>
      <span>{error || 'Preparing your lineage graph'}</span>
      <button onClick={onImport}>Import artifacts</button>
    </div>
  </>;
}
