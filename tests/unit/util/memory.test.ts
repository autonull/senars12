import { abortSession, createSession, InMemorySessionManager } from '@senars/util/memory';
import type { ConversationSession } from '@senars/util/types/memory';
import { describe, expect, it } from 'vitest';

describe('createSession', () => {
  it('produces a fresh session with unique id and empty history', () => {
    const a = createSession('k1');
    const b = createSession('k1');
    expect(a.id).not.toBe(b.id);
    expect(a.key).toBe('k1');
    expect(a.history).toEqual([]);
    expect(a.metadata).toEqual({});
    expect(typeof a.createdAt).toBe('number');
    expect(a.lastSeenAt).toBeGreaterThanOrEqual(a.createdAt);
  });
});

describe('abortSession', () => {
  it('marks the session aborted and clears history', () => {
    const s = createSession('k');
    s.history.push({ role: 'user', content: 'hi' } as never);
    abortSession(s);
    expect(s.metadata.aborted).toBe(true);
    expect(s.history).toEqual([]);
  });
});

describe('InMemorySessionManager', () => {
  it('creates a session on first getOrCreate', () => {
    const mgr = new InMemorySessionManager();
    const s = mgr.getOrCreate('alice');
    expect(s.key).toBe('alice');
    expect(mgr.size()).toBe(1);
  });

  it('returns the same session for the same key', () => {
    const mgr = new InMemorySessionManager();
    const s1 = mgr.getOrCreate('bob');
    const s2 = mgr.getOrCreate('bob');
    expect(s1).toBe(s2);
    expect(mgr.size()).toBe(1);
  });

  it('updates lastSeenAt on subsequent access', () => {
    const mgr = new InMemorySessionManager();
    const s = mgr.getOrCreate('carol');
    const before = s.lastSeenAt;
    s.lastSeenAt = before - 10_000;
    const again = mgr.getOrCreate('carol');
    expect(again.lastSeenAt).toBeGreaterThanOrEqual(before);
  });

  it('maintains separate sessions per key', () => {
    const mgr = new InMemorySessionManager();
    mgr.getOrCreate('x');
    mgr.getOrCreate('y');
    expect(mgr.size()).toBe(2);
  });

  it('aborted session remains retrievable by key', () => {
    const mgr = new InMemorySessionManager();
    const s = mgr.getOrCreate('z');
    abortSession(s);
    const again = mgr.getOrCreate('z');
    expect(again).toBe(s);
    expect(again.metadata.aborted).toBe(true);
  });

  it('satisfies the SessionManager interface', () => {
    const mgr: InMemorySessionManager = new InMemorySessionManager();
    const s: ConversationSession = mgr.getOrCreate('iface');
    expect(s).toBeDefined();
  });
});
