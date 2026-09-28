import type { Term } from '../../terms';

export type LinkType =
  | 'term-link'
  | 'inheritance'
  | 'similarity'
  | 'implication'
  | 'temporal'
  | 'semantic';

export type LinkForgetPolicy = 'priority' | 'lru' | 'fifo' | 'random';

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
}
