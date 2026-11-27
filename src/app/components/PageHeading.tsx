import { Network } from 'lucide-react';

export function PageHeading({ counts }: { counts: Record<string, number> }) {
  return <div className="page-heading">
    <div className="title-row">
      <div className="title-with-icon"><span className="title-icon"><Network size={20} /></span><h1>Lineage explorer</h1></div>
      <div className="heading-summary">
        <span><i className="summary-dot model-dot" /> {(counts.model || 0).toLocaleString()} models</span>
        <span><i className="summary-dot source-dot" /> {(counts.source || 0).toLocaleString()} sources</span>
      </div>
    </div>
  </div>;
}
