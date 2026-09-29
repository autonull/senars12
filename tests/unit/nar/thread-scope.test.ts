import { ThreadScope } from '@senars/nar/kernel';
import { describe, expect, it } from 'vitest';

const FILL = 1100;

describe('ThreadScope', () => {
  it('returns a stable object per correlationId', () => {
    const scope = new ThreadScope();
    const first = scope.get('a');
    first.sourceKey = 'user-1';
    expect(scope.get('a')).toBe(first);
    expect(scope.has('a')).toBe(true);
  });

  it('isolates distinct correlationIds', () => {
    const scope = new ThreadScope();
    scope.get('a').sourceKey = 'user-1';
    expect(scope.get('b').sourceKey).toBeUndefined();
  });

  it('supports delete, listing and clear', () => {
    const scope = new ThreadScope();
    scope.get('a');
    scope.get('b');
    expect([...scope.correlationIds()].sort()).toEqual(['a', 'b']);
    expect(scope.delete('a')).toBe(true);
    expect(scope.has('a')).toBe(false);
    scope.clear();
    expect(scope.correlationIds()).toEqual([]);
  });

  it('stays bounded when correlationIds outnumber the capacity', () => {
    const scope = new ThreadScope();
    for (let i = 0; i < FILL; i++) scope.get(`thread-${i}`);
    const live = scope.correlationIds().length;
    expect(live).toBeGreaterThan(0);
    expect(live).toBeLessThanOrEqual(1024);
  });

  it('evicts the least recently used scope, keeping hot ones', () => {
    const scope = new ThreadScope();
    const hot = scope.get('hot');
    for (let i = 0; i < FILL; i++) scope.get(`thread-${i}`);
    expect(scope.has('hot')).toBe(false);

    const reread = new ThreadScope();
    const first = reread.get('first');
    first.sourceKey = 'user-1';
    for (let i = 0; i < 1000; i++) reread.get(`thread-${i}`);
    expect(reread.get('first')).toBe(first);

    for (let i = 0; i < 1000; i++) reread.get(`late-${i}`);
    expect(reread.get('first')).toBe(first);
    expect(reread.has('thread-0')).toBe(false);
  });
});
