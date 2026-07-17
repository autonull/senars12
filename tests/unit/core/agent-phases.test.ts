import type { CognitiveEvent } from '@senars/core';
import type { CycleHost } from '@senars/core/agent/phases';
import { runCycle } from '@senars/core/agent/phases';
import { describe, expect, it, vi } from 'vitest';

function makeHost(overrides: Partial<CycleHost> = {}): CycleHost & {
  emitted: CognitiveEvent[];
  appended: unknown[];
  consolidatedIds: string[];
} {
  const emitted: CognitiveEvent[] = [];
  const appended: unknown[] = [];
  const consolidatedIds: string[] = [];
  const host = {
    log: { append: vi.fn(async (e: Omit<CognitiveEvent, 'id' | 'timestamp'>) => ({ ...e, id: 'x', timestamp: 0 })) },
    memory: {
      recent: vi.fn(() => []),
      queryEpisodic: vi.fn(async () => []),
      querySemantic: vi.fn(async () => []),
      append: (entry: unknown) => appended.push(entry),
      consolidate: vi.fn(async (id: string) => consolidatedIds.push(id)),
    },
    engines: new Map(),
    policy: { checkCommand: vi.fn(() => ({ allowed: true })) },
    motor: { execute: vi.fn(async () => ({ success: true, content: null })) },
    emit: (e: CognitiveEvent) => emitted.push(e),
    getLastResponse: () => '',
    setLastResponse: () => {},
    emitted,
    appended,
    consolidatedIds,
    ...overrides,
  } as unknown as CycleHost & { emitted: CognitiveEvent[]; appended: unknown[]; consolidatedIds: string[] };
  return host;
}

const stimulus = {
  id: 's1',
  correlationId: 'c1',
  text: 'hello',
  source: 'chat',
  timestamp: Date.now(),
};

describe('Agent cycle phases (extracted)', () => {
  it('perceive emits an input.user cognitive event', async () => {
    const host = makeHost();
    await runCycle(host, stimulus);
    const types = host.emitted.map((e) => e.type);
    expect(types).toContain('input.user');
  });

  it('recall queries working, episodic and semantic memory', async () => {
    const host = makeHost();
    await runCycle(host, stimulus);
    expect(host.memory.recent).toHaveBeenCalledWith(50);
    expect(host.memory.queryEpisodic).toHaveBeenCalled();
    expect(host.memory.querySemantic).toHaveBeenCalledWith('hello');
  });

  it('reason delegates to every registered engine', async () => {
    const reason = vi.fn(async () => []);
    const host = makeHost({
      engines: new Map([['nar', { reason } as never]]),
    });
    await runCycle(host, stimulus);
    expect(reason).toHaveBeenCalled();
  });

  it('narrate falls back to appending derivations when no cortex present', async () => {
    const reason = vi.fn(async () => [{ term: 'derived', truth: { frequency: 1, confidence: 0.9 }, stamp: {} }]);
    const host = makeHost({ engines: new Map([['nar', { reason } as never]]) });
    await runCycle(host, stimulus);
    const derivationAppends = host.appended.filter(
      (e) => typeof e === 'object' && e !== null && (e as { type?: string }).type === 'derivation',
    );
    expect(derivationAppends.length).toBeGreaterThanOrEqual(1);
  });

  it('act parses commands and executes allowed tools, respecting policy', async () => {
    const execute = vi.fn(async () => ({ success: true, content: null }));
    const checkCommand = vi.fn((cmd: string) =>
      cmd === 'forbidden' ? { allowed: false, reason: 'nope' } : { allowed: true },
    );
    const host = makeHost({
      cortex: { synthesize: vi.fn(async () => ({ text: 'allowed' })) } as never,
      motor: { execute },
      policy: { checkCommand },
      commandParser: () => [
        { command: 'send', args: ['hi'], raw: 'send hi' },
        { command: 'allowed', args: [], raw: 'allowed' },
        { command: 'forbidden', args: [], raw: 'forbidden' },
      ],
    });
    await runCycle(host, stimulus);
    expect(execute).toHaveBeenCalledWith('allowed', expect.any(Object), 'c1');
    expect(checkCommand).toHaveBeenCalledWith('forbidden');
  });

  it('consolidate logs narrative to episodic memory and consolidates event log', async () => {
    const host = makeHost({
      cortex: { synthesize: vi.fn(async () => ({ text: 'a narrative' })) } as never,
      episodicMemory: { log: vi.fn(async () => {}) } as never,
    });
    await runCycle(host, stimulus);
    expect(host.memory.consolidate).toHaveBeenCalled();
  });
});
