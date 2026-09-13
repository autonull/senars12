import { bootstrapStdLib, clearOps } from '@senars/metta';
import { MettaEngine } from '@senars/metta/engine/MettaEngine';
import { beforeAll, describe, expect, it } from 'vitest';

describe('MeTTa engine tool invocation', () => {
  let engine: MettaEngine;

  beforeAll(async () => {
    clearOps();
    bootstrapStdLib();
    engine = new MettaEngine();
    await engine.initialize();
  });

  it('evaluates arithmetic expressions', async () => {
    const result = await engine.reason(
      { text: 'metta:(+ 2 3)', source: 'test', timestamp: Date.now(), correlationId: 'test-1' },
      { working: [], episodic: [], semantic: [] }
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('evaluates skill expressions', async () => {
    const result = await engine.reason(
      { text: 'metta:(+ 10 20)', source: 'test', timestamp: Date.now(), correlationId: 'test-2' },
      { working: [], episodic: [], semantic: [] }
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('queries via pattern match', async () => {
    const result = await engine.query('(+ $x $y)');
    expect(Array.isArray(result)).toBe(true);
  });
});
