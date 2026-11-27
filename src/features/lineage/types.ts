import type { Node } from '@xyflow/react';
import type { Resource } from '../../types/lineage.ts';

export type Direction = 'upstream' | 'downstream';
export type ExpandedBranches = Record<Direction, Set<string>>;
export interface Port { id: string; type: 'source' | 'target'; side: 'EAST' | 'WEST'; y: number }
export type ResourceNodeData = {
  resource: Resource;
  isRoot: boolean;
  upstreamCount: number;
  downstreamCount: number;
  expanded: Record<Direction, boolean>;
  onToggle: (id: string, direction: Direction) => void;
  ports: Port[];
};
export type ResourceFlowNode = Node<ResourceNodeData, 'resource'>;
