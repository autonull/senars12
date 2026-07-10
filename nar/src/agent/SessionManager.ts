import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { type Logger, createLogger } from '../logger';
import {
  type ConversationSession,
  DEFAULT_SESSION_HISTORY_LIMIT,
  type SessionMessage,
  createSession,
} from './ConversationSession.js';

export interface SessionManager {
  getOrCreate(key: string): ConversationSession;

  markDirty(session: ConversationSession): Promise<void>;

  evictExpired(ttlMs: number): number;

  snapshot(): Promise<void>;

  restore(): Promise<void>;

  size(): number;

  close(): Promise<void>;
}

interface ManagerOptions {
  historyLimit?: number;
  flushIntervalMs?: number;
  logger?: Logger;
}

const safeFile = (key: string): string => key.replace(/[^a-zA-Z0-9_-]/g, '_');

export class InMemorySessionManager implements SessionManager {
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly historyLimit: number;
  private readonly logger: Logger;

  constructor(opts: ManagerOptions = {}) {
    this.historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
    this.logger = opts.logger ?? createLogger({ scope: 'session:in-memory' });
  }

  getOrCreate(key: string): ConversationSession {
    let session = this.sessions.get(key);
    if (!session) {
      session = createSession(key);
      this.sessions.set(key, session);
    } else {
      session.lastSeenAt = Date.now();
    }
    return session;
  }

  async markDirty(_session: ConversationSession): Promise<void> {
    // no-op for in-memory
  }

  evictExpired(ttlMs: number): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, session] of this.sessions) {
      if (now - session.lastSeenAt > ttlMs) {
        this.sessions.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  async snapshot(): Promise<void> {
    // no-op
  }

  async restore(): Promise<void> {
    // no-op
  }

  size(): number {
    return this.sessions.size;
  }

  async close(): Promise<void> {
    // no-op
  }
}

export interface JsonlSessionManagerOptions extends ManagerOptions {
  basePath: string;
}

interface JsonlEntry {
  timestamp: number;
  role: SessionMessage['role'];
  content: string;
  metadata?: Record<string, unknown>;
}

export class JsonlSessionManager implements SessionManager {
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly basePath: string;
  private readonly historyLimit: number;
  private readonly dirty = new Set<string>();
  private readonly logger: Logger;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(opts: JsonlSessionManagerOptions) {
    this.basePath = opts.basePath;
    this.historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
    this.logger = opts.logger ?? createLogger({ scope: 'session:jsonl' });
    const flushMs = opts.flushIntervalMs ?? 5000;
    this.flushTimer = setInterval(() => {
      this.flushAll().catch(() => undefined);
    }, flushMs);
    if (typeof this.flushTimer.unref === 'function') this.flushTimer.unref();
  }

  getOrCreate(key: string): ConversationSession {
    let session = this.sessions.get(key);
    if (!session) {
      session = createSession(key);
      this.sessions.set(key, session);
    } else {
      session.lastSeenAt = Date.now();
    }
    return session;
  }

  async markDirty(session: ConversationSession): Promise<void> {
    this.dirty.add(session.key);
  }

  evictExpired(ttlMs: number): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, session] of this.sessions) {
      if (now - session.lastSeenAt > ttlMs) {
        this.sessions.delete(key);
        this.dirty.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  async snapshot(): Promise<void> {
    await this.flushAll();
  }

  async restore(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      const files = await fs.readdir(this.basePath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const key = file.slice(0, -'.jsonl'.length);
        try {
          const content = await fs.readFile(join(this.basePath, file), 'utf-8');
          const lines = content.split('\n').filter((l) => l.trim());
          const entries: JsonlEntry[] = [];
          for (const line of lines) {
            try {
              entries.push(JSON.parse(line) as JsonlEntry);
            } catch {
              // skip malformed
            }
          }
          if (entries.length === 0) continue;
          const session = createSession(key);
          for (const e of entries) {
            session.history.push({
              role: e.role,
              content: e.content,
              timestamp: e.timestamp,
              ...(e.metadata ? { metadata: e.metadata } : {}),
            });
          }
          session.lastSeenAt = entries[entries.length - 1]?.timestamp ?? session.createdAt;
          this.sessions.set(key, session);
        } catch {
          // skip unreadable file
        }
      }
    } catch {
      // basePath may not exist yet
    }
  }

  size(): number {
    return this.sessions.size;
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushAll();
  }

  private async flushAll(): Promise<void> {
    if (this.dirty.size === 0) return;
    await fs.mkdir(this.basePath, { recursive: true });
    const keys = [...this.dirty];
    for (const key of keys) {
      const session = this.sessions.get(key);
      if (!session) {
        this.dirty.delete(key);
        continue;
      }
      await this.writeQueue;
      const keyCopy = key;
      this.writeQueue = this.writeSession(session)
        .then(() => {
          this.dirty.delete(keyCopy);
        })
        .catch((err) => {
          this.dirty.delete(keyCopy);
          this.logger.error(
            'session flush failed',
            err instanceof Error ? err : new Error(String(err)),
            { key: keyCopy }
          );
        });
    }
    await this.writeQueue;
  }

  private async writeSession(session: ConversationSession): Promise<void> {
    const file = join(this.basePath, `${safeFile(session.key)}.jsonl`);
    const lines = session.history.map((m) =>
      JSON.stringify({
        timestamp: m.timestamp,
        role: m.role,
        content: m.content,
        metadata: m.metadata ?? {},
      } satisfies JsonlEntry)
    );
    await fs.writeFile(file, lines.join('\n') + (lines.length ? '\n' : ''), 'utf-8');
  }
}
