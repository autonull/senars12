import type { Term } from '../../terms';

export type LinkType =
  | 'term-link'
  | 'inheritance'
  | 'similarity'
  | 'implication'
  | 'temporal'
  | 'semantic';

export interface LinkEntry {
  id: string;
  sourceTerm: Term;
  targetTerm: Term;
  type: LinkType;
  priority: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface LinkManagerConfig {
  defaultCapacity: number;
  layers: Record<string, number>;
  globalDecayRate: number;
  forgetPolicy: 'priority' | 'lru' | 'fifo' | 'random';
}

export interface SerializedLinkEntry {
  id: string;
  sourceTerm: string;
  targetTerm: string;
  type: LinkType;
  priority: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface SerializedLayer {
  name: string;
  capacity: number;
  links: SerializedLinkEntry[];
}

export interface SerializedLinkManager {
  version: 1;
  layers: SerializedLayer[];
  config: LinkManagerConfig;
}
