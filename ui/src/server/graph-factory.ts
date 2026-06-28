import type { GraphOpType, GraphNodeData } from '../shared/protocol.js';

export function createNodeOp(id: string, data: GraphNodeData): GraphOpType {
  return { action: 'add_node' as const, id, data };
}

export function createEdgeOp(source: string, target: string, weight: number, type = 'semantic'): GraphOpType {
  return { action: 'add_edge' as const, source, target, data: { weight, type } };
}
