import { PushQueue } from '@senars/util/events';
import type { CognitiveEvent, EventLog } from './EventLog.js';
import { EventLogError } from './EventLog.js';

export interface EventLogLimits {
  maxEvents: number;
  maxEventSize: number;
}

const DEFAULT_LIMITS: EventLogLimits = { maxEvents: 100_000, maxEventSize: 1024 * 1024 };

export abstract class AbstractEventLog implements EventLog {
  #subscribers = new Set<Subscription>();
  #snapshots = new Map<string, Map<number, unknown>>();
  #closed = false;
  protected readonly limits: EventLogLimits;

  constructor(limits: Partial<EventLogLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  /** Shared append preconditions: closed log, oversized event, or full store. */
  protected assertAppendable(fullEvent: CognitiveEvent, isFull: boolean): void {
    if (this.#closed) {
      throw new EventLogError('UNAVAILABLE', 'Event log is closed');
    }

    const eventSize = JSON.stringify(fullEvent).length;
    if (eventSize > this.limits.maxEventSize) {
      throw new EventLogError(
        'INVALID_EVENT',
        `Event size ${eventSize} exceeds max ${this.limits.maxEventSize}`
      );
    }

    if (isFull) {
      throw new EventLogError('FULL', `Event log full (${this.limits.maxEvents} events)`);
    }
  }

  protected markClosed(): void {
    this.#closed = true;
  }

  async close(): Promise<void> {
    this.markClosed();
  }

  abstract get size(): number;

  abstract get events(): ReadonlyArray<CognitiveEvent>;

  abstract generateId(): string;

  abstract getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;


  async append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent> {
    if (this.#closed) {
      throw new Error('Event log is closed');
    }
    this.validatePayload(event.type, event.payload);
    const full = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    } as CognitiveEvent;
    await this.doAppend(full);
    this.notify(full);
    return full;
  }

  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent> {
    const typesSet = options?.types ? new Set(options.types) : undefined;

    const subscription: Subscription = {
      filter: options?.filter,
      fromId: options?.fromId,
      types: typesSet,
      queue: new PushQueue<CognitiveEvent>(),
    };

    this.#subscribers.add(subscription);

    if (options?.fromId) {
      this.getRange(options.fromId).then((events) => {
        for (const event of events) {
          if (typesSet && !typesSet.has(event.type)) continue;
          if (options.filter && !options.filter(event)) continue;
          subscription.queue.push(event);
        }
      });
    }

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => subscription.queue.next(),
        return: async () => {
          subscription.queue.close();
          return { value: undefined, done: true };
        },
      }),
    };
  }

  getSnapshot<T>(projectionName: string, version: number): Promise<T | null> {
    return Promise.resolve((this.#snapshots.get(projectionName)?.get(version) as T) ?? null);
  }

  saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void> {
    const map = this.#snapshots.get(projectionName) ?? new Map();
    map.set(version, data);
    this.#snapshots.set(projectionName, map);
    return Promise.resolve();
  }

  notify(event: CognitiveEvent): void {
    for (const sub of this.#subscribers) {
      if (sub.queue.closed) continue;
      try {
        if (sub.fromId && sub.fromId >= (event.id ?? '')) continue;
        if (sub.types && !sub.types.has(event.type)) continue;
        if (sub.filter && !sub.filter(event)) continue;
        sub.queue.push(event);
      } catch {
        // ignore handler errors
      }
    }
  }

  protected abstract doAppend(event: CognitiveEvent): Promise<void>;

  protected validatePayload(type: string, payload: unknown): void {
    const p = payload as Record<string, unknown>;
    switch (type) {
      case 'input.user': {
        if (!p || typeof p.text !== 'string' || typeof p.source !== 'string') {
          throw new Error(
            'Invalid payload for input.user: requires { text: string, source: string }'
          );
        }
        break;
      }
      case 'derivation.made': {
        if (
          !p ||
          typeof p.rule !== 'string' ||
          !Array.isArray(p.premises) ||
          typeof p.conclusion !== 'string'
        ) {
          throw new Error('Invalid payload for derivation.made');
        }
        break;
      }
      case 'atom.derived':
      case 'atom.retracted': {
        if (!p || typeof p.atom !== 'string' || typeof p.space !== 'string') {
          throw new Error(`Invalid payload for ${type}: requires { atom: string, space: string }`);
        }
        break;
      }
      case 'belief.added': {
        if (!p || typeof p.term !== 'string' || !p.truth || typeof p.truth !== 'object') {
          throw new Error('Invalid payload for belief.added');
        }
        const truth = p.truth as Record<string, unknown>;
        if (typeof truth.frequency !== 'number' || typeof truth.confidence !== 'number') {
          throw new Error('Invalid truth value in belief.added');
        }
        break;
      }
      case 'belief.retracted': {
        if (!p || typeof p.term !== 'string') {
          throw new Error('Invalid payload for belief.retracted: requires { term: string }');
        }
        break;
      }
      case 'belief.revised': {
        if (!p || typeof p.term !== 'string' || !p.oldTruth || !p.newTruth) {
          throw new Error('Invalid payload for belief.revised');
        }
        break;
      }
      case 'drive.changed': {
        if (!p || typeof p.drive !== 'string' || typeof p.urgency !== 'number') {
          throw new Error('Invalid payload for drive.changed');
        }
        break;
      }
      case 'goal.achieved':
      case 'goal.failed': {
        if (!p || typeof p.goal !== 'string') {
          throw new Error(`Invalid payload for ${type}: requires { goal: string }`);
        }
        if (type === 'goal.failed' && typeof (p as Record<string, unknown>).reason !== 'string') {
          throw new Error(
            'Invalid payload for goal.failed: requires { goal: string, reason: string }'
          );
        }
        break;
      }
      case 'concept.activated': {
        if (!p || typeof p.term !== 'string' || typeof p.priority !== 'number') {
          throw new Error('Invalid payload for concept.activated');
        }
        break;
      }
      case 'skill.executed': {
        if (
          !p ||
          typeof p.skill !== 'string' ||
          !Array.isArray(p.args) ||
          typeof p.result !== 'string' ||
          typeof p.durationMs !== 'number'
        ) {
          throw new Error('Invalid payload for skill.executed');
        }
        break;
      }
      case 'tool.request': {
        if (!p || typeof p.toolName !== 'string' || !p.args) {
          throw new Error('Invalid payload for tool.request');
        }
        break;
      }
      case 'tool.response': {
        if (
          !p ||
          typeof p.requestId !== 'string' ||
          typeof p.toolName !== 'string' ||
          typeof p.durationMs !== 'number'
        ) {
          throw new Error('Invalid payload for tool.response');
        }
        break;
      }
      case 'config.set': {
        if (!p || typeof p.path !== 'string') {
          throw new Error('Invalid payload for config.set');
        }
        break;
      }
      case 'config.delete': {
        if (!p || typeof p.path !== 'string') {
          throw new Error('Invalid payload for config.delete');
        }
        break;
      }
      case 'config.schema': {
        if (!p?.schema) {
          throw new Error('Invalid payload for config.schema');
        }
        break;
      }
      case 'kernel.ready': {
        if (!p || !Array.isArray(p.backendIds)) {
          throw new Error('Invalid payload for kernel.ready');
        }
        break;
      }
      case 'backend.registered': {
        if (!p?.manifest) {
          throw new Error('Invalid payload for backend.registered');
        }
        break;
      }
      case 'bootstrap': {
        if (!p) {
          throw new Error('Invalid payload for bootstrap');
        }
        break;
      }
      case 'cycle': {
        if (!p || typeof p.cycle !== 'number' || typeof p.derived !== 'number') {
          throw new Error('Invalid payload for cycle');
        }
        break;
      }
      case 'health': {
        if (
          !p ||
          typeof p.status !== 'string' ||
          typeof p.cycleCount !== 'number' ||
          typeof p.errorRate !== 'number'
        ) {
          throw new Error('Invalid payload for health');
        }
        break;
      }
      case 'conflict:detected': {
        if (!p || typeof p.term !== 'string' || typeof p.conflictWith !== 'string') {
          throw new Error('Invalid payload for conflict:detected');
        }
        break;
      }
      default:
        // Unknown event types are allowed (extensibility)
        break;
    }
  }
}

interface Subscription {
  filter?: (event: CognitiveEvent) => boolean;
  fromId?: string;
  types?: Set<string>;
  queue: PushQueue<CognitiveEvent>;
}
