import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { abortSession, createSession, InMemorySessionManager } from '@senars/util/memory';
import type { ConversationSession, SessionManager } from '@senars/util/types/memory';

/**
 * @deprecated Will be removed in next major version.
 * Use `import { InMemorySessionManager, createSession, abortSession } from '@senars/util/memory'` instead.
 */
export { abortSession, createSession, InMemorySessionManager };

export interface JsonlSessionManagerConfig {
  basePath: string;
}

export class JsonlSessionManager implements SessionManager {
  #sessions = new Map<string, ConversationSession>();
  readonly #basePath: string;

  constructor(config: JsonlSessionManagerConfig) {
    this.#basePath = config.basePath;
  }

  getOrCreate(key: string): ConversationSession {
    const existing = this.#sessions.get(key);
    if (existing) {
      existing.lastSeenAt = Date.now();
      return existing;
    }
    const session = createSession(key);
    this.#sessions.set(key, session);
    return session;
  }

  size(): number {
    return this.#sessions.size;
  }

  async restore(): Promise<void> {
    try {
      const entries = await fs.readdir(this.#basePath);
      for (const entry of entries) {
        if (!entry.endsWith('.jsonl')) continue;
        const key = entry.slice(0, -6);
        const content = await fs.readFile(join(this.#basePath, entry), 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);
        const history: ConversationSession['history'] = lines.map((l) => JSON.parse(l));
        this.#sessions.set(key, {
          id: `sess-${key}`,
          key,
          history,
          createdAt: Date.now(),
          lastSeenAt: Date.now(),
          metadata: {},
        });
      }
    } catch {
      // directory doesn't exist yet
    }
  }

  async snapshot(): Promise<void> {
    await fs.mkdir(this.#basePath, { recursive: true });
    for (const [key, session] of this.#sessions) {
      const lines = session.history.map((h) => JSON.stringify(h)).join('\n');
      await fs.writeFile(join(this.#basePath, `${key}.jsonl`), lines, 'utf-8');
    }
  }

  async close(): Promise<void> {
    await this.snapshot();
    this.#sessions.clear();
  }
}
