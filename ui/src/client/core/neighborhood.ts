/**
 * Semantic neighborhood navigation (§2.4). Given a block, walk its links to the
 * blocks it touches, breadth-first to a bounded depth, so a surface can offer
 * "open related" without owning traversal. Pure and deterministic; the overlay
 * owns presentation and focus. Links are read from the one WorkspaceGraph, so a
 * chat block, an artifact and an engine claim navigate identically.
 */

import { linksTouching, type Ref, type SemanticBlock, type SemanticLink, type WorkspaceGraph } from './workspace-graph.js';

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

export function neighborhood(graph: WorkspaceGraph, ref: Ref, depth = 1): Neighborhood | undefined {
  const block = graph.blocks.get(ref);
  if (!block) return undefined;

  const seen = new Set<Ref>([ref]);
  const neighbors: Neighbor[] = [];
  let frontier: Ref[] = [ref];

  for (let hop = 1; hop <= depth && frontier.length > 0; hop++) {
    const next: Ref[] = [];
    for (const id of frontier) {
      for (const link of linksTouching(graph, id)) {
        const otherId = link.source === id ? link.target : link.source;
        const other = graph.blocks.get(otherId);
        if (!other || seen.has(otherId)) continue;
        seen.add(otherId);
        neighbors.push({ block: other, link, direction: link.source === id ? 'out' : 'in', depth: hop });
        next.push(otherId);
      }
    }
    frontier = next;
  }

  return { block, neighbors };
}
