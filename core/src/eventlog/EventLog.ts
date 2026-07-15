export type { CognitiveEvent } from '../events/EventTypes.js';
import type { CognitiveEvent } from '../events/EventTypes.js';

export interface EventLog {
  append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;

  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent>;

  getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;

  getSnapshot<T>(projectionName: string, version: number): Promise<T | null>;

  saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void>;
}

export class EventLogError extends Error {
  constructor(
    public readonly code: 'FULL' | 'UNAVAILABLE' | 'INVALID_EVENT' | 'SERIALIZATION_FAILED',
    message: string,
    public override readonly cause?: Error
  ) {
    super(message, { cause });
    this.name = 'EventLogError';
  }
}

export interface EventLogConfig {
  maxEvents?: number;
  maxEventSize?: number;
}