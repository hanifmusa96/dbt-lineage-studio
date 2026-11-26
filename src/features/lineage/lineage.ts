import type { Column, ExpandedBranches, LineageEdge, LineageGraph, Neighborhood } from './types.ts';

interface DbtResource {
  resource_type: string;
  name?: string;
  schema?: string;
  database?: string;
  package_name?: string;
  source_name?: string;
  description?: string;
  original_file_path?: string;
  config?: { materialized?: string };
  columns?: Record<string, Column>;
  depends_on?: { nodes?: string[] };
}

interface Manifest {
  nodes: Record<string, DbtResource>;
  sources?: Record<string, DbtResource>;
  exposures?: Record<string, DbtResource>;
  metrics?: Record<string, DbtResource>;
  semantic_models?: Record<string, DbtResource>;
  saved_queries?: Record<string, DbtResource>;
  parent_map?: Record<string, string[]>;
  metadata?: LineageGraph['metadata'];
}

interface Catalog {
  nodes: Record<string, { columns?: Record<string, Column> }>;
  sources?: Record<string, { columns?: Record<string, Column> }>;
}

const SUPPORTED = new Set(['model', 'source', 'seed', 'snapshot', 'exposure', 'analysis', 'metric', 'semantic_model', 'saved_query']);

export function buildLineage(manifestInput: unknown, catalogInput: unknown): LineageGraph {
  if (!manifestInput || typeof manifestInput !== 'object' || !('nodes' in manifestInput) || !manifestInput.nodes || typeof manifestInput.nodes !== 'object' || Array.isArray(manifestInput.nodes)) {
    throw new Error('Invalid manifest.json: expected a nodes object.');
  }
  if (!catalogInput || typeof catalogInput !== 'object' || !('nodes' in catalogInput) || !catalogInput.nodes || typeof catalogInput.nodes !== 'object' || Array.isArray(catalogInput.nodes)) {
    throw new Error('Invalid catalog.json: expected a nodes object.');
  }
  const manifest = manifestInput as Manifest;
  const catalog = catalogInput as Catalog;
  const resources: LineageGraph['resources'] = {};
  for (const collection of ['nodes', 'sources', 'exposures', 'metrics', 'semantic_models', 'saved_queries'] as const) {
    for (const [id, resource] of Object.entries(manifest[collection] || {})) {
      if (!resource || !SUPPORTED.has(resource.resource_type)) continue;
      const catalogNode = (resource.resource_type === 'source' ? catalog.sources : catalog.nodes)?.[id];
      const columnsByName = { ...(resource.columns || {}) };
      for (const [name, column] of Object.entries(catalogNode?.columns || {})) {
        columnsByName[name] = { ...columnsByName[name], ...column };
      }
      const columns = Object.values(columnsByName)
        .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));
      resources[id] = {
        id,
        name: resource.name || id,
        type: resource.resource_type,
        schema: resource.schema || '',
        database: resource.database || '',
        packageName: resource.package_name || '',
        sourceName: resource.source_name || '',
        description: resource.description || '',
        materialization: resource.config?.materialized || '',
        path: resource.original_file_path || '',
        columns,
        dependencies: resource.depends_on?.nodes || manifest.parent_map?.[id] || [],
      };
    }
  }
  const parents: LineageGraph['parents'] = {};
  const children: LineageGraph['children'] = {};
  for (const id of Object.keys(resources)) {
    parents[id] = [];
    children[id] = [];
  }
  for (const resource of Object.values(resources)) {
    for (const parent of new Set(resource.dependencies)) {
      if (resources[parent] && parent !== resource.id) {
        parents[resource.id].push(parent);
        children[parent].push(resource.id);
      }
    }
  }
  return { resources, parents, children, metadata: manifest.metadata || {} };
}

export function getNeighborhood(graph: LineageGraph, root: string, expanded: ExpandedBranches, limit = 100): Neighborhood {
  if (!graph.resources[root]) return { ids: [], edges: [], truncated: false };
  const seen = new Set([root]);
  const queue = [root];
  const edges: LineageEdge[] = [];
  const edgeIds = new Set<string>();
  let truncated = false;
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const direction of ['upstream', 'downstream'] as const) {
      if (!expanded[direction].has(id)) continue;
      const neighbors = direction === 'upstream' ? graph.parents[id] : graph.children[id];
      for (const neighbor of neighbors) {
        if (!seen.has(neighbor)) {
          if (seen.size >= limit) { truncated = true; continue; }
          seen.add(neighbor);
          queue.push(neighbor);
        }
        const source = direction === 'upstream' ? neighbor : id;
        const target = direction === 'upstream' ? id : neighbor;
        const edgeId = JSON.stringify([source, target]);
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId);
          edges.push({ source, target });
        }
      }
    }
  }
  return { ids: [...seen], edges, truncated };
}

export function defaultResource(graph: LineageGraph): string {
  const models = Object.values(graph.resources).filter((resource) => resource.type === 'model');
  return models.find((resource) => {
    const count = graph.parents[resource.id].length + graph.children[resource.id].length;
    return count >= 2 && count <= 8;
  })?.id || models[0]?.id || Object.keys(graph.resources)[0] || '';
}
