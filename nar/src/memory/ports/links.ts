/**
 * The link port — what "what is associated with this term?" means to a consumer.
 *
 * `LinkManager` is already a separate class with its own config, but every
 * consumer reached it *through* `Memory`, which is how a storage type became a
 * reasoning dependency. Declaring the surface as a port here is what lets
 * `MemoryView` stop naming the concrete manager (TODO29.a §5.5).
 */

import type { Term } from '../../terms/index.js';
import type { Layer } from '../links/Layer.js';
import type { LinkEntry, LinkType } from '../links/types.js';

export interface LinkPort {
  getLinks(
    sourceTerm: Term,
    options?: { layer?: string; type?: LinkType; minPriority?: number }
  ): LinkEntry[];
  getLinkPriority(sourceTerm: Term, targetTerm: Term, layerName?: string): number;
  addLink(
    sourceTerm: Term,
    targetTerm: Term,
    options?: { layer?: string; type?: LinkType; priority?: number }
  ): LinkEntry | null;
  removeByTerm(sourceTerm: Term, targetTerm: Term, type?: LinkType): boolean;
  removeAllLinksForTerm(term: Term): void;
  getLayer(name: string): Layer | undefined;
  setLayer(name: string, layer: Layer): void;
  applyDecay(decayRate?: number): void;
}
