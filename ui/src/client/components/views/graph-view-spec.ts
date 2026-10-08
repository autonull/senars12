import { $graphNodes, viewSource } from '../../core/index.js';
import type { ViewSpec } from '../../core/view-spec.js';
import { graphTable } from './graph-table.js';

/**
 * The graph's tabular view. The 2D/3D viewport is the `graph` shape and stays
 * store-driven (it is the `graph-viewport` adapter seam, §4.6/8.5); this spec is
 * the `table` alternative the app renders when the graph shape is set to table,
 * sharing the one selection model so a row click opens the same inspector.
 */
export const GRAPH_VIEW_SPEC: ViewSpec = {
  id: 'graph',
  title: 'Graph',
  shapes: ['table'],
  source: viewSource($graphNodes, graphTable),
};
