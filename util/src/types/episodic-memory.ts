export type EpisodeType =
  | 'input'
  | 'response'
  | 'belief_added'
  | 'question'
  | 'tool_call'
  | 'error'
  | 'dialogue'
  | 'reaction';

export interface Episode {
  timestamp: number;
  type: EpisodeType;
  content: string;
  metadata: Record<string, unknown>;
  /** Causal-graph fields (REFACTOR.todo1 Phase D) — optional, JSONL-tolerant. */
  id?: string;
  /** Upstream episode/turn references (e.g. reaction → dialogue turnId). */
  causes?: string[];
  consequences?: string[];
  context?: string[];
}

export interface EpisodicMemoryConfig {
  enabled: boolean;
  basePath: string;
  retentionDays: number;
  maxEntriesPerFile: number;
}

/** Episode query filter (REFACTOR.todo2 Phase A: causal traversal over edge fields). */
export interface EpisodeFilter {
  timeRange?: [number, number];
  type?: EpisodeType;
  limit?: number;
  sessionId?: string;
  correlationId?: string;
  /** Episodes whose `causes` contains the given episode id. */
  causedBy?: string;
  /** Episodes whose `consequences` contains the given episode id. */
  leadingTo?: string;
}

export interface EpisodicMemory {
  log(type: EpisodeType, content: string, metadata?: Record<string, unknown>): Promise<void>;

  getRecent(limit?: number): Promise<Episode[]>;

  search(query: string, limit?: number): Promise<Episode[]>;

  close(): Promise<void>;
}
