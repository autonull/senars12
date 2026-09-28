/**
 * Read-only memory port.
 *
 * The strategy layer (attention, sampling, premise formation) must not depend
 * on the `Memory` facade — the facade itself owns a `CognitiveRegistry` and
 * therefore imports the strategies back. Declaring the read surface here as a
 * leaf module keeps `strategies/ → memory/` a one-way, acyclic edge and turns
 * the implicit contract into a single checked interface.
 */

import type { Concept } from './concept.js';
import { type Focus } from './focus.js';
import { type EmbeddingLayer } from './links/EmbeddingLayer.js';
import { type LinkManager } from './links/index.js';
import type { RandomSource } from '../types/primitives.js';
import type { Task } from '../types/index.js';
import type { Term } from '../terms/index.js';

export interface MemoryView {
  getFocus(): Focus;
  getConcept(term: Term): Concept | undefined;
  getLinkManager(): LinkManager;
  getEmbeddingIndex(): EmbeddingLayer | undefined;
  getGoals(): Task[];
  listConcepts(): Concept[];
  conceptValues(): IterableIterator<Concept>;
  sample(limit: number): Concept[];
  sampleWindow(windowSize: number, rng?: RandomSource): Concept[];
}

export type { EmbeddingLayer, Focus, LinkManager };
