import { useState } from 'react';
import { defaultResource } from '../utils/lineage.ts';
import type { LineageGraph } from '../../../types/lineage.ts';

export function useLineageView() {
  const [rootId, setRootId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [graphVersion, setGraphVersion] = useState(0);

  const focus = (id: string) => {
    setRootId(id); setSelectedId(''); setGraphVersion((version) => version + 1);
  };
  const reset = (graph: LineageGraph) => focus(defaultResource(graph));

  return { rootId, selectedId, graphVersion, setSelectedId, focus, reset };
}
