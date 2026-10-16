/**
 * Semantic neighborhood navigation (§2.4). Given a block, walk its links to the
 * blocks it touches, breadth-first to a bounded depth, so a surface can offer
 * "open related" without owning traversal. Pure and deterministic; the overlay
 * owns presentation and focus. Links are read from the one WorkspaceGraph, so a
 * chat block, an artifact and an engine claim navigate identically.
 */

import { type Ref, type SemanticBlock, type SemanticLink, type WorkspaceGraph } from './workspace-graph.js';
import { neighborhood as contractNeighborhood } from '@senars/ui-contract/core';

export interface Neighbor {
  block: SemanticBlock;
  link: SemanticLink;
  /** `out` when the link points from the origin to this block, `in` when it points back. */
  direction: 'in' | 'out';
  /** Hop distance from the origin (1 = directly linked). */
  depth: number;
}

export interface Neighborhood {
  block: SemanticBlock;
  neighbors: Neighbor[];
}

// Runtime implementation delegates to @senars/ui-contract; the interface above keeps
// SeNARS-refined Neighbor/Neighborhood block types.
// SeNARS specialization: runtime body delegates to the contract implementation;
// the refined `Neighbor`/`Neighborhood` types above keep block semantics.
export const neighborhood = contractNeighborhood as unknown as (
  graph: WorkspaceGraph,
  ref: Ref,
  depth?: number,
) => Neighborhood | undefined;
