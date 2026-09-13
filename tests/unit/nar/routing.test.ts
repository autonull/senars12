import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  demoteModel,
  getModelChain,
  pickBestModel,
  pickModel,
  resetDemotions,
  resolveOfflineModel,
  setRouting,
} from '@senars/nar/lm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

afterEach(() => {
  setRouting(null);
  resetDemotions();
});

describe('pickModel (objective-driven candidate scoring)', () => {
  const candidates = ['cloud:quality', 'local:quality', 'builtin:compact', 'builtin:mock'];

  it('hard-filters offlineOnly candidates', () => {
    const ranked = pickModel(candidates, { offlineOnly: true });
    expect(ranked.find((c) => c.id === 'cloud:quality')?.qualifies).toBe(false);
    expect(pickBestModel(candidates, { offlineOnly: true })).toMatch(/^builtin:/);
  });

  it('hard-filters candidates exceeding maxLatencyMs', () => {
    const ranked = pickModel(
      ['cloud:quality', 'local:quality', 'builtin:quality', 'builtin:compact'],
      { maxLatencyMs: 6_000 }
    );
    const disqualified = ranked.filter((c) => !c.qualifies).map((c) => c.id);
    expect(disqualified).toEqual(['builtin:quality']);
  });

  it('ranks quality-max toward the frontier model', () => {
    expect(pickBestModel(candidates, { quality: 'max' })).toBe('cloud:quality');
  });

  it('prefers fast zero-cost local models under balanced quality', () => {
    expect(pickBestModel(candidates, { quality: 'balanced' })).toBe('builtin:compact');
  });

  it('down-ranks candidates with failed call stats', () => {
    const stats = {
      'cloud:quality': { successRate: 0 } as never,
    };
    const [top] = pickModel(['cloud:quality', 'local:quality'], { quality: 'max' }, stats);
    if (!top) throw new Error('expected ranked candidates');
    expect(top.id).toBe('local:quality');
  });

  it('always returns a deterministic order', () => {
    const a = pickModel(candidates).map((c) => [c.id, c.score] as const);
    const b = pickModel(candidates).map((c) => [c.id, c.score] as const);
    expect(a).toEqual(b);
  });
});

describe('getModelChain (routing from config)', () => {
  it('composes candidates + failsafe ladder and applies per-task constraints', () => {
    setRouting({
      candidates: ['cloud:quality', 'local:quality', 'builtin:quality'],
      objectives: { fast: { offlineOnly: true }, quality: { maxLatencyMs: 1_000 } },
    });
    expect(getModelChain('anthropic', 'quality')).toEqual([
      'cloud:quality',
      'local:quality',
      'builtin:compact',
      'builtin:mock',
    ]);
    expect(getModelChain('anthropic', 'fast')).toEqual([
      'builtin:quality',
      'builtin:compact',
      'builtin:mock',
    ]);
  });

  it('offlineOnly objective strips non-builtin candidates per task', () => {
    setRouting({ candidates: ['cloud:quality', 'local:quality'] });
    expect(getModelChain('anthropic', 'quality')).toContain('cloud:quality');
    setRouting({
      candidates: ['cloud:quality', 'local:quality'],
      objectives: { structured: { offlineOnly: true } },
    });
    expect(getModelChain('anthropic', 'structured')).toEqual(['builtin:compact', 'builtin:mock']);
  });

  it('demoted candidates sink to the back of the chain', () => {
    setRouting({ candidates: ['cloud:quality', 'local:quality'] });
    expect(getModelChain('anthropic', 'quality')[0]).toBe('cloud:quality');
    demoteModel('cloud:quality', 'test failure');
    expect(getModelChain('anthropic', 'quality')).toEqual([
      'local:quality',
      'cloud:quality',
      'builtin:compact',
      'builtin:mock',
    ]);
  });

  it('falls back to the default provider chains without routing config', () => {
    expect(getModelChain('mock', 'quality')).toEqual(['builtin:mock']);
  });
});

describe('resolveOfflineModel (self-upgrading offline ladder)', () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'senars-ladder-'));
  afterAll(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('picks the largest cached rung, ignoring uncached rungs', () => {
    mkdirSync(join(cacheDir, 'models--small--smollm2'), { recursive: true });
    mkdirSync(join(cacheDir, 'models--mid--qwen2.5-1.5b-instruct'), { recursive: true });
    const ladder = ['small/smollm2', 'mid/qwen2.5-1.5b-instruct', 'big/qwen2.5-7b-instruct'];
    expect(resolveOfflineModel(ladder, cacheDir)).toBe('mid/qwen2.5-1.5b-instruct');
  });

  it('returns undefined when nothing is cached', () => {
    expect(resolveOfflineModel(['a/b'], join(cacheDir, 'empty'))).toBeUndefined();
  });
});
