import type { GraphNodeData } from '@senars/core';
import type { TableDataset } from '../../core/view-spec.js';

/**
 * The graph's tabular projection: the same concepts the viewport paints, as rows.
 * It is the graph surface's accessible alternative and the source the table
 * adapter renders, so the canvas has a text equivalent without a second renderer.
 */
export const graphTable = (nodes: Map<string, GraphNodeData>): TableDataset => ({
  kind: 'table',
  columns: [
    { id: 'term', label: 'Term' },
    { id: 'nodeType', label: 'Type' },
    { id: 'priority', label: 'Priority' },
    { id: 'confidence', label: 'Confidence' },
  ],
  rows: [...nodes].map(([id, node]) => ({
    id,
    term: node.term ?? node.label ?? id,
    nodeType: node.nodeType,
    priority: node.priority ?? 0,
    confidence: node.confidence ?? 0,
  })),
});
