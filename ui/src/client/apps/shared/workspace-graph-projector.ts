/**
 * WorkspaceGraphProjector — shared projection logic for workspace graph.
 *
 * Provides projectWorkspaceGraph with optional kind filtering and reactive updates.
 */
import { $workspaceGraph } from '../../kernel/index.js';
import { projectWorkspaceGraph, type WorkspaceProjection } from '../../kernel/domain.js';

export interface GraphProjectionConfig {
  nodeKinds?: readonly string[];
  edgeKinds?: readonly string[];
}

export interface UseGraphProjectionReturn {
  projection: WorkspaceProjection;
  nodeCount: number;
  edgeCount: number;
  hasContent: boolean;
  /** Call to manually refresh the projection. */
  refresh: () => void;
  /** Call to unsubscribe from workspace graph updates. */
  unsubscribe: () => void;
}

/**
 * Creates a reactive graph projection tied to the workspace graph atom.
 * Call the returned `refresh()` after the host component mounts to initialize.
 * Call `unsubscribe()` in host's disconnectedCallback to clean up.
 */
export function createGraphProjector(
  config: GraphProjectionConfig = {},
  onUpdate?: () => void
): UseGraphProjectionReturn {
  const { nodeKinds, edgeKinds } = config;

  let projection: WorkspaceProjection = { nodes: new Map(), edges: new Map() };

  const update = (): void => {
    const graph = $workspaceGraph.get();
    const full = projectWorkspaceGraph(graph);

    if (nodeKinds && nodeKinds.length > 0) {
      const allowedNodes = new Set(
        [...full.nodes].filter(([, node]) => nodeKinds.includes(node.kind)).map(([id]) => id)
      );
      projection = {
        nodes: new Map([...full.nodes].filter(([id]) => allowedNodes.has(id))),
        edges: new Map([...full.edges].filter(([, edge]) => allowedNodes.has(edge.source) && allowedNodes.has(edge.target))),
      };
    } else if (edgeKinds && edgeKinds.length > 0) {
      const allowedEdges = new Set(
        [...full.edges].filter(([, edge]) => edgeKinds.includes(edge.type)).map(([id]) => id)
      );
      projection = {
        nodes: new Map([...full.nodes].filter(([id]) => {
          return [...full.edges].some(([, e]) => allowedEdges.has(e.id) && (e.source === id || e.target === id));
        })),
        edges: new Map([...full.edges].filter(([, edge]) => allowedEdges.has(edge.id))),
      };
    } else {
      projection = full;
    }
    onUpdate?.();
  };

  // Subscribe to workspace graph changes
  const unsubscribe = $workspaceGraph.subscribe(update);
  update();

  return {
    get projection() { return projection; },
    get nodeCount() { return projection.nodes.size; },
    get edgeCount() { return projection.edges.size; },
    get hasContent() { return projection.nodes.size > 0 || projection.edges.size > 0; },
    refresh: update,
    unsubscribe,
  };
}