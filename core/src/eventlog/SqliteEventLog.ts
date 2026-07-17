import { monotonicFactory } from 'ulid';

const ulid = monotonicFactory();
import Database from 'better-sqlite3';
import { AbstractEventLog } from './AbstractEventLog.js';
import type { EventLog, EventLogConfig, CognitiveEvent } from './EventLog.js';
import { EventLogError } from './EventLog.js';

export interface SqliteEventLogConfig extends EventLogConfig {
  path: string;
}

interface Subscription {
  filter?: (e: CognitiveEvent) => boolean;
  fromId?: string;
  types?: Set<string>;
  queue: CognitiveEvent[];
  resolver: ((value: IteratorResult<CognitiveEvent>) => void) | null;
}

interface Row {
  id: string;
  type: string;
  payload: string;
  timestamp: number;
  correlation_id: string | null;
  causation_id: string | null;
}

export class SqliteEventLog extends AbstractEventLog {
  #db: Database.Database;
  #subscribers: Set<Subscription> = new Set();
  #config: Required<SqliteEventLogConfig>;
  #closed = false;

  constructor(config: SqliteEventLogConfig) {
    super();
    this.#config = {
      maxEvents: config.maxEvents ?? 100_000,
      maxEventSize: config.maxEventSize ?? 1024 * 1024,
      path: config.path,
    };
    this.#db = new Database(this.#config.path);
    this.#db.pragma('journal_mode = WAL');
    this.#db.pragma('synchronous = NORMAL');
    this.#init();
  }

  #init(): void {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        correlation_id TEXT,
        causation_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_id ON events(id);

      CREATE TABLE IF NOT EXISTS snapshots (
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (name, version)
      );
    `);
  }

  generateId(): string {
    return ulid();
  }

  protected async doAppend(fullEvent: CognitiveEvent): Promise<void> {
    if (this.#closed) {
      throw new EventLogError('UNAVAILABLE', 'Event log is closed');
    }

    const eventSize = JSON.stringify(fullEvent).length;
    if (eventSize > this.#config.maxEventSize) {
      throw new EventLogError(
        'INVALID_EVENT',
        `Event size ${eventSize} exceeds max ${this.#config.maxEventSize}`
      );
    }

    const count = this.#db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number };
    if (count.c >= this.#config.maxEvents) {
      throw new EventLogError('FULL', `Event log full (${this.#config.maxEvents} events)`);
    }

    this.#db
      .prepare(
        `INSERT INTO events (id, type, payload, timestamp, correlation_id, causation_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(fullEvent.id, fullEvent.type, JSON.stringify(fullEvent.payload), fullEvent.timestamp, fullEvent.correlationId ?? null, fullEvent.causationId ?? null);

    this.#notify(fullEvent);
  }

  #rowToEvent(row: Row): CognitiveEvent {
    return {
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
      correlationId: row.correlation_id ?? undefined,
      causationId: row.causation_id ?? undefined,
    } as CognitiveEvent;
  }

  #notify(event: CognitiveEvent): void {
    for (const sub of this.#subscribers) {
      if (sub.fromId && sub.fromId >= (event.id ?? '')) continue;
      if (sub.types && !sub.types.has(event.type)) continue;
      if (sub.filter && !sub.filter(event)) continue;
      sub.queue.push(event);
      if (sub.resolver) {
        const resolver = sub.resolver;
        sub.resolver = null;
        resolver({ value: event, done: false });
      }
    }
  }

  override subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent> {
    const typesSet = options?.types ? new Set(options.types) : undefined;
    const queue: CognitiveEvent[] = [];
    let closed = false;

    const subscription: Subscription = {
      filter: options?.filter,
      fromId: options?.fromId,
      types: typesSet,
      queue,
      resolver: null,
    };

    this.#subscribers.add(subscription);

    let initialEvents: CognitiveEvent[] = [];
    if (options?.fromId) {
      this.getRange(options.fromId).then((events) => {
        initialEvents = events;
        for (const event of events) {
          if (typesSet && !typesSet.has(event.type)) continue;
          if (options.filter && !options.filter(event)) continue;
          queue.push(event);
        }
      });
    }

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<CognitiveEvent>> {
            // Wait for initial events if needed
            while (initialEvents.length > 0) {
              // just wait for the promise to resolve
              await new Promise((r) => setTimeout(r, 0));
            }
            while (queue.length > 0) {
              const nextEvent = queue.shift();
              if (nextEvent) return { value: nextEvent, done: false };
            }
            if (closed) {
              return { value: undefined, done: true };
            }
            return new Promise<IteratorResult<CognitiveEvent>>((res) => {
              subscription.resolver = res;
            });
          },
          async return(): Promise<IteratorResult<CognitiveEvent>> {
            closed = true;
            subscription.resolver = null;
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  async getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]> {
    const stmt = this.#db.prepare(
      toId
        ? 'SELECT * FROM events WHERE id > ? AND id <= ? ORDER BY id'
        : 'SELECT * FROM events WHERE id > ? ORDER BY id'
    );
    const rows = toId ? stmt.all(fromId, toId) : stmt.all(fromId);
    return (rows as Row[]).map((row) => this.#rowToEvent(row));
  }

  async close(): Promise<void> {
    this.#closed = true;
    for (const sub of this.#subscribers) {
      if (sub.resolver) sub.resolver({ value: undefined, done: true });
    }
    this.#subscribers.clear();
    this.#db.close();
  }

  get size(): number {
    const row = this.#db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number };
    return row.c;
  }

  get events(): ReadonlyArray<CognitiveEvent> {
    const rows = this.#db.prepare('SELECT * FROM events ORDER BY id').all() as Row[];
    return rows.map((row) => this.#rowToEvent(row));
  }
}