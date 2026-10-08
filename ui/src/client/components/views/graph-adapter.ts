import { registerViewAdapter } from '../../core/view-adapter.js';

/**
 * The graph adapter is the seam over the existing 2D/3D viewports: both read the
 * shared store, so the shape resolves to the 2D `graph-viewport` element today.
 * Migrating the viewport onto the `ViewSpec` source (and the 2D/3D toggle) is
 * Phase 4.6/8.5; until then this registration makes "graph" a first-class shape
 * the host can resolve.
 */
registerViewAdapter({
  shape: 'graph',
  tag: 'graph-viewport',
  budgets: ['full', 'embedded'],
  interactions: ['select', 'multi-select', 'zoom', 'link', 'highlight', 'filter'],
});