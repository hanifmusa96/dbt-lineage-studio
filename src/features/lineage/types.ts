import type { Node } from '@xyflow/react';

export interface Column {
  name?: string;
  type?: string;
  data_type?: string;
  comment?: string;
  index?: number;
  [key: string]: unknown;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  schema: string;
  database: string;
  packageName: string;
  sourceName: string;
  description: string;
  materialization: string;
  path: string;
  columns: Column[];
  dependencies: string[];
}

export interface LineageGraph {
  resources: Record<string, Resource>;
  parents: Record<string, string[]>;
  children: Record<string, string[]>;
  metadata: { project_name?: string; [key: string]: unknown };
}

export type Direction = 'upstream' | 'downstream';
export type ExpandedBranches = Record<Direction, Set<string>>;
export type Theme = 'light' | 'dark';
export interface LineageEdge { source: string; target: string }
export interface Neighborhood { ids: string[]; edges: LineageEdge[]; truncated: boolean }
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
