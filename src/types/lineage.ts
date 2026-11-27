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

export type Theme = 'light' | 'dark';
export interface LineageEdge { source: string; target: string }
export interface Neighborhood { ids: string[]; edges: LineageEdge[]; truncated: boolean }
