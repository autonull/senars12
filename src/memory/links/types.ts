import type { Clock } from '@senars/util';
import type { Term } from '../../terms';
import type { RandomSource } from '../../types/primitives.js';

export type LinkType =
  | 'term-link'
  | 'inheritance'
  | 'similarity'
  | 'implication'
  | 'temporal'
  | 'semantic';

/** The forget policies a link layer accepts — one declaration, so the config
 *  surface and the eviction table below cannot admit a policy the other lacks. */
export const LINK_FORGET_POLICIES = ['priority', 'lru', 'fifo', 'random'] as const;

export type LinkForgetPolicy = (typeof LINK_FORGET_POLICIES)[number];

/** Well-known associative-memory layers; any other name registers on demand. */
export const LINK_LAYER = { TERM: 'term', EMBEDDING: 'embedding' } as const;

export type KnownLinkLayer = (typeof LINK_LAYER)[keyof typeof LINK_LAYER];

export interface LinkEntry {
  id: string;
  sourceTerm: Term;
  targetTerm: Term;
  type: LinkType;
  priority: number;
  createdAt: number;
  lastAccessedAt: number;
  data?: Record<string, unknown>;
}

export interface LinkInput {
  sourceTerm: Term;
  targetTerm: Term;
  type?: LinkType;
  priority?: number;
  data?: Record<string, unknown>;
}

export interface LinkQuery {
  type?: LinkType;
  minPriority?: number;
  maxResults?: number;
}

export interface LinkManagerConfig {
  defaultCapacity: number;
  layers: Record<string, number>;
  globalDecayRate: number;
  forgetPolicy: LinkForgetPolicy;
  /** Injected randomness for the random-forget policy (default `ambientRng`). */
  rng?: RandomSource;
  /** Injected clock for link recency (default `systemClock`). */
  clock?: Clock;
}
