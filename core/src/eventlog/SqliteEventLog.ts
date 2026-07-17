import { monotonicFactory } from 'ulid';

const ulid = monotonicFactory();
import Database from 'better-sqlite3';
import { AbstractEventLog } from './AbstractEventLog.js';
import type { EventLog, EventLogConfig, CognitiveEvent } from './EventLog.js';
import { EventLogError } from './EventLog.js';

export interface SqliteEventLogConfig extends EventLogConfig {
  path: string;
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