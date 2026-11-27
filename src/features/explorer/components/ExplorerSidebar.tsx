import { Filter, PanelLeftClose, Search } from 'lucide-react';
import { ResourceIcon } from '../../../components/ResourceIcon.tsx';
import type { Resource } from '../../../types/lineage.ts';
import './ExplorerSidebar.css';

const LIST_LIMIT = 100;

export function ExplorerSidebar({ matches, counts, search, filter, activeId, hasGraph, onSearch, onFilter, onSelect, onClose }: {
  matches: Resource[];
  counts: Record<string, number>;
  search: string;
  filter: string;
  activeId: string;
  hasGraph: boolean;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return <aside className="sidebar">
    <div className="sidebar-head">
      <h2>Explore</h2>
      <button className="icon-button" title="Hide explorer" onClick={onClose}><PanelLeftClose size={17} /></button>
    </div>
    <label className="search-box"><Search size={16} /><input placeholder="Search resources..." value={search} onChange={(event) => onSearch(event.target.value)} /></label>
    <div className="filter-row">
      <span><Filter size={13} /> RESOURCE TYPE</span>
      <select aria-label="Filter resource type" value={filter} onChange={(event) => onFilter(event.target.value)}>
        <option value="all">All types</option>
        {Object.keys(counts).sort().map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
    </div>
    <div className="list-heading"><span>RESOURCES <span className="count-pill">{matches.length.toLocaleString()}</span></span></div>
    <div className="resource-list">
      {matches.slice(0, LIST_LIMIT).map((resource) => <button key={resource.id} className={`resource-item ${activeId === resource.id ? 'active' : ''}`} onClick={() => onSelect(resource.id)} title={resource.id}>
        <span className={`list-icon ${resource.type}`}><ResourceIcon type={resource.type} size={15} /></span>
        <span className="resource-name"><strong>{resource.name}</strong><small>{resource.schema || resource.packageName || resource.type}</small></span>
        <span className="item-chevron">›</span>
      </button>)}
      {matches.length > LIST_LIMIT && <div className="list-more">Showing {LIST_LIMIT} of {matches.length.toLocaleString()} resources. Search to narrow results.</div>}
      {hasGraph && matches.length === 0 && <div className="list-more">No matching resources.</div>}
    </div>
  </aside>;
}
