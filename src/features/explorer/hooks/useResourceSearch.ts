import { useMemo, useState } from 'react';
import type { LineageGraph, Resource } from '../../../types/lineage.ts';

export function useResourceSearch(graph: LineageGraph | null) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchedGraph, setSearchedGraph] = useState(graph);
  if (searchedGraph !== graph) {
    setSearchedGraph(graph); setSearch(''); setFilter('all');
  }

  const resources = useMemo(() => graph ? Object.values(graph.resources) : [], [graph]);
  const counts = useMemo(() => resources.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {}), [resources]);
  const matches = useMemo<Resource[]>(() => {
    const query = search.trim().toLowerCase();
    return resources.filter((item) => (filter === 'all' || item.type === filter) &&
      (!query || [item.name, item.schema, item.packageName, item.sourceName, item.id].some((value) => value.toLowerCase().includes(query))));
  }, [resources, search, filter]);

  return { search, setSearch, filter, setFilter, counts, matches };
}
