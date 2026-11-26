import { ArrowUpRight, Database, Layers2, Table2 } from 'lucide-react';

export function ResourceIcon({ type, size = 16 }: { type: string; size?: number }) {
  if (type === 'source') return <Database size={size} />;
  if (type === 'exposure') return <ArrowUpRight size={size} />;
  if (type === 'seed') return <Table2 size={size} />;
  return <Layers2 size={size} />;
}

