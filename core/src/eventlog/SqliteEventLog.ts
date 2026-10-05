import { getOrInsert } from '@senars/util';
import Database from 'better-sqlite3';
import { AbstractEventLog } from './AbstractEventLog.js';
import type { CognitiveEvent, EventLogConfig, EventLogQuery } from './EventLog.js';

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

/**
 * Every statement this log issues is compiled once and kept: `better-sqlite3`'s
 * `prepare` is a parse plus a plan build, so re-preparing on each append put one
 * in front of every write — behind a `SELECT COUNT(*)` to read a number the log
 * maintains itself.
 */
export class SqliteEventLog extends AbstractEventLog {
  #db: Database.Database;
  #config: Required<SqliteEventLogConfig>;
  #statements = new Map<string, Database.Statement>();
  /** Row count, read once at open and carried forward: the log is its own writer. */
  #count = 0;

  constructor(config: SqliteEventLogConfig) {
    super(config);
    this.#config = {
      ...config,
      maxEvents: this.limits.maxEvents,
      maxEventSize: this.limits.maxEventSize,
    };
    this.#db = new Database(this.#config.path);
    this.#db.pragma('journal_mode = WAL');
    this.#db.pragma('synchronous = NORMAL');
    this.#init();
    const { c } = this.#stmt('SELECT COUNT(*) as c FROM events').get() as { c: number };
    this.#count = c;
  }

  /** Compile-once statement cache; the SQL is the key, so a query shape is stored once. */
  #stmt(sql: string): Database.Statement {
    return getOrInsert(this.#statements, sql, () => this.#db.prepare(sql));
  }

  get size(): number {
    return this.#count;
  }

  get events(): ReadonlyArray<CognitiveEvent> {
    const rows = this.#stmt('SELECT * FROM events ORDER BY id').all() as Row[];
    return rows.map((row) => this.#rowToEvent(row));
  }

  async query(query: EventLogQuery): Promise<CognitiveEvent[]> {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (query.correlationId) {
      clauses.push('correlation_id = ?');
      params.push(query.correlationId);
    }
    if (query.types?.length) {
      clauses.push(`type IN (${query.types.map(() => '?').join(',')})`);
      params.push(...query.types);
    }
    if (query.timeRange) {
      const [start, end] = query.timeRange;
      clauses.push('timestamp >= ? AND timestamp <= ?');
      params.push(start, end);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    // Clamped so a non-positive cap reads as "no rows", which is what
    // `InMemoryEventLog.query` does with the same input; sqlite would otherwise
    // read a negative LIMIT as no limit at all.
    const order =
      query.limit !== undefined
        ? ` ORDER BY id DESC LIMIT ${Math.max(0, Math.floor(query.limit))}`
        : ' ORDER BY id';
    // The `WHERE` shape varies with the filter, so this one is compiled per query
    // rather than cached — the shapes are caller-chosen, not a fixed statement.
    const rows = this.#db.prepare(`SELECT * FROM events ${where}${order}`).all(...params) as Row[];
    const events = rows.map((row) => this.#rowToEvent(row));
    return query.limit !== undefined ? events.reverse() : events;
  }

  async getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]> {
    const stmt = this.#stmt(
      toId
        ? 'SELECT * FROM events WHERE id > ? AND id <= ? ORDER BY id'
        : 'SELECT * FROM events WHERE id > ? ORDER BY id'
    );
    const rows = toId ? stmt.all(fromId, toId) : stmt.all(fromId);
    return (rows as Row[]).map((row) => this.#rowToEvent(row));
  }

  override async close(): Promise<void> {
    this.markClosed();
    this.#statements.clear();
    this.#db.close();
  }

  protected async doAppend(fullEvent: CognitiveEvent, payloadJson: string): Promise<void> {
    this.assertAppendable(payloadJson, this.#count >= this.limits.maxEvents);

    this.#stmt(
      `INSERT INTO events (id, type, payload, timestamp, correlation_id, causation_id)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      fullEvent.id,
      fullEvent.type,
      payloadJson,
      fullEvent.timestamp,
      fullEvent.correlationId ?? null,
      fullEvent.causationId ?? null
    );
    this.#count++;
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

  async getSnapshot<T>(projectionName: string, version: number): Promise<T | null> {
    const row = this.#stmt('SELECT data FROM snapshots WHERE name = ? AND version = ?').get(
      projectionName,
      version
    ) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : null;
  }

  async saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void> {
    this.#stmt(
      'INSERT INTO snapshots (name, version, data) VALUES (?, ?, ?) ON CONFLICT(name, version) DO UPDATE SET data = excluded.data'
    ).run(projectionName, version, JSON.stringify(data));
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
}
