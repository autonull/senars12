import { beforeEach, describe, expect, it } from 'vitest';
import { InMemorySpace } from '../src/core/space.js';
import { PatternMatcher } from '../src/engine/match.js';
import { expr, sym, varr } from '../src/index.js';

describe('PatternMatcher', () => {
  let space: InMemorySpace;
  let matcher: PatternMatcher;

  beforeEach(() => {
    space = new InMemorySpace('test');
    space.add(sym('cat'));
    space.add(sym('dog'));
    space.add(expr(sym('likes'), sym('cat'), sym('fish')));
    space.add(expr(sym('likes'), sym('dog'), sym('bone')));
    matcher = new PatternMatcher(space);
  });

  it('matches symbols', () => {
    const results = [...matcher.match(sym('cat'))];
    expect(results).toHaveLength(1);
  });

  it('matches expressions', () => {
    const pattern = expr(sym('likes'), sym('cat'), varr('$x'));
    const results = [...matcher.match(pattern)];
    expect(results).toHaveLength(1);
    expect(results[0]?.get('$x')?.value).toBe('fish');
  });

  it('matches multiple results', () => {
    const pattern = expr(sym('likes'), varr('$who'), varr('$what'));
    const results = [...matcher.match(pattern)];
    expect(results).toHaveLength(2);
  });

  it('returns substitutions', () => {
    const pattern = expr(sym('likes'), varr('$who'), varr('$what'));
    const subst = matcher.findOne(pattern);
    expect(subst?.get('$who')?.value).toBe('cat');
    expect(subst?.get('$what')?.value).toBe('fish');
  });
});
