import { NAREngine } from '@senars/nar/engine/NAREngine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('NAREngine lifecycle', () => {
  let engine: NAREngine;

  beforeEach(() => {
    engine = new NAREngine();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('initializes and starts the underlying NAR kernel', async () => {
    expect(engine.nar.isRunning()).toBe(false);
    await engine.initialize();
    expect(engine.nar.isRunning()).toBe(true);
  });

  it('shutdown stops the kernel and is idempotent', async () => {
    await engine.initialize();
    expect(engine.nar.isRunning()).toBe(true);
    await engine.shutdown();
    expect(engine.nar.isRunning()).toBe(false);
    await expect(engine.shutdown()).resolves.toBeUndefined();
    expect(engine.nar.isRunning()).toBe(false);
  });

  it('initialize is idempotent (does not double-start)', async () => {
    await engine.initialize();
    const firstStart = engine.nar.isRunning();
    await engine.initialize();
    expect(engine.nar.isRunning()).toBe(firstStart);
  });

  it('performs reasoning after initialization', async () => {
    await engine.initialize();
    const derivations = await engine.reason(
      {
        id: 't1',
        correlationId: 'c1',
        text: '<cat --> mammal>.',
        source: 'chat',
        timestamp: Date.now(),
      },
      { working: [], episodic: [], semantic: [] }
    );
    expect(Array.isArray(derivations)).toBe(true);
  });

  it('query returns results after initialization', async () => {
    await engine.initialize();
    const results = await engine.query('<cat --> mammal>');
    expect(Array.isArray(results)).toBe(true);
  });
});
