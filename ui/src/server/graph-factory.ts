import type { GraphOp, GraphNodeData } from '../shared/protocol.js';

export function createNodeOp(id: string, data: GraphNodeData): GraphOp {
  return { action: 'add_node' as const, id, data };
}

export function createEdgeOp(source: string, target: string, weight: number, type = 'semantic'): GraphOp {
  return { action: 'add_edge' as const, source, target, data: { weight, type, directed: true } };
}
