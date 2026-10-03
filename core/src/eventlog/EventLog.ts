import { SenarsError } from '@senars/util';

export type { CognitiveEvent } from '../schemas/cognitive-events.js';

import type { CognitiveEvent } from '../schemas/cognitive-events.js';

/** Phase D (REFACTOR.todo1): indexed event-log query. All fields optional. */
export interface EventLogQuery {
  correlationId?: string;
  types?: string[];
  timeRange?: [number, number];
  limit?: number;
}

export interface EventLog {
  append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;

  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent>;

  /** Optional indexed query — implementations without an index may omit it. */
  query?(query: EventLogQuery): Promise<CognitiveEvent[]>;

  getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;

  getSnapshot<T>(projectionName: string, version: number): Promise<T | null>;

  saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void>;
}

export class EventLogError extends SenarsError {
  constructor(
    code: 'FULL' | 'UNAVAILABLE' | 'INVALID_EVENT' | 'SERIALIZATION_FAILED',
    message: string,
    cause?: Error
  ) {
    super(message, code, undefined, { cause });
    this.name = 'EventLogError';
  }
}

export interface EventLogConfig {
  maxEvents?: number;
  maxEventSize?: number;
}
