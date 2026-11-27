import { ArrowUpRight, Database, Layers2, Table2 } from 'lucide-react';

export function LineageLegend() {
  return <div className="graph-legend">
    <span>LEGEND</span>
    <span><i className="legend-icon source"><Database size={12} /></i> Source</span>
    <span><i className="legend-icon model"><Layers2 size={12} /></i> Model</span>
    <span><i className="legend-icon seed"><Table2 size={12} /></i> Seed</span>
    <span><i className="legend-icon exposure"><ArrowUpRight size={12} /></i> Exposure</span>
    <div className="legend-spacer" />
    <span>Model-level lineage</span>
  </div>;
}
