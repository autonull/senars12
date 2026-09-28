import { describe, expect, it } from 'vitest';
import { ProviderRuntime } from '../../nar/src/lm/provider-runtime.js';
import { CallAccounting, textCodec } from '../../nar/src/lm/service/accounting.js';
import { createLMService } from '../../nar/src/lm/lm-service.js';

const TRANSPORT_FAILURE = new Error('fetch failed: ECONNREFUSED');
const LOGIC_FAILURE = new Error('schema mismatch');

const runtimeWith = (modelId = 'cloud:quality') => {
  const runtime = new ProviderRuntime();
  runtime.lastDecision = { task: 'fast', modelId, reason: 'primary' };
  return runtime;
};

const spec = (prompt = 'ping') => ({
  task: 'fast' as const,
  prompt,
  cacheKey: prompt,
  ...textCodec,
});

describe('LM call accounting', () => {
  it('records a failure, re-probes, and demotes the model after two transport failures', async () => {
    const runtime = runtimeWith();
    let reprobes = 0;
    const accounting = new CallAccounting(runtime, async () => {
      reprobes++;
    });
    const gate = accounting.gate('fast', 'mock');
    const envelope = spec();

    await accounting.settle(envelope, Date.now(), gate, {
      ok: false,
      error: TRANSPORT_FAILURE,
      committed: false,
    });
    expect(runtime.demotions.size).toBe(0);
    await accounting.settle(envelope, Date.now(), gate, {
      ok: false,
      error: TRANSPORT_FAILURE,
      committed: false,
    });
    expect([...runtime.demotions.values()][0]?.reason).toMatch(/repeated transport failures \(2\)/);

    expect(reprobes).toBe(2);
    expect(accounting.stats.failedCalls).toBe(2);
    expect(accounting.stats.successfulCalls).toBe(0);
  });

  it('a non-transport failure is accounted but never re-probed or demoted', async () => {
    const runtime = runtimeWith();
    let reprobes = 0;
    const accounting = new CallAccounting(runtime, async () => {
      reprobes++;
    });
    const gate = accounting.gate('fast', 'mock');

    for (let i = 0; i < 3; i++) {
      await accounting.settle(spec(), Date.now(), gate, {
        ok: false,
        error: LOGIC_FAILURE,
        committed: false,
      });
    }
    expect(reprobes).toBe(0);
    expect(runtime.demotions.size).toBe(0);
    expect(accounting.stats.failedCalls).toBe(3);
  });

  it('a success resets the consecutive-failure count', async () => {
    const runtime = runtimeWith();
    const accounting = new CallAccounting(runtime);
    const gate = accounting.gate('fast', 'mock');

    await accounting.settle(spec(), Date.now(), gate, {
      ok: false,
      error: TRANSPORT_FAILURE,
      committed: false,
    });
    await accounting.settle(spec(), Date.now(), gate, { ok: true, value: 'pong' });
    await accounting.settle(spec(), Date.now(), gate, {
      ok: false,
      error: TRANSPORT_FAILURE,
      committed: false,
    });
    expect(runtime.demotions.size).toBe(0);
  });

  it('a committed stream failure keeps the cached value — no complete value replaced it', async () => {
    const runtime = runtimeWith();
    const accounting = new CallAccounting(runtime);
    const gate = accounting.gate('fast', 'mock');
    const envelope = spec();

    await accounting.settle(envelope, Date.now(), gate, { ok: true, value: 'complete' });
    expect(accounting.lookup(envelope, gate)).toEqual({ hit: true, value: 'complete' });

    await accounting.settle(envelope, Date.now(), gate, {
      ok: false,
      error: TRANSPORT_FAILURE,
      committed: true,
    });
    expect(accounting.lookup(envelope, gate)).toEqual({ hit: true, value: 'complete' });

    await accounting.settle(envelope, Date.now(), gate, {
      ok: false,
      error: TRANSPORT_FAILURE,
      committed: false,
    });
    expect(accounting.lookup(envelope, gate)).toEqual({ hit: false });
  });

  it('a cache hit short-circuits the transport and still records the call', async () => {
    const runtime = runtimeWith();
    const accounting = new CallAccounting(runtime);
    const gate = accounting.gate('fast', 'mock');
    let calls = 0;
    const envelope = spec();

    const value = await accounting.execute(
      {
        ...envelope,
        run: async ({ report }) => {
          calls++;
          report({ inputTokens: 3, outputTokens: 4 });
          return 'pong';
        },
      },
      gate
    );
    expect(value).toBe('pong');
    expect(await accounting.execute({ ...envelope, run: async () => (calls++, 'skipped') }, gate)).toBe(
      'pong'
    );
    expect(calls).toBe(1);
    expect(accounting.stats.totalCalls).toBe(2);
    expect(accounting.getSpend().mock?.tokensOut).toBe(4);
  });

  it('structured values round-trip through the JSON codec on a cache hit', async () => {
    const runtime = runtimeWith();
    const accounting = new CallAccounting(runtime);
    const gate = accounting.gate('structured', 'mock');
    const envelope = {
      task: 'structured' as const,
      prompt: 'shape me',
      cacheKey: 'structured:shape me',
      encode: (value: { ok: boolean }) => JSON.stringify(value),
      decode: (raw: string) => JSON.parse(raw) as { ok: boolean },
    };
    let calls = 0;
    const first = await accounting.execute(
      { ...envelope, run: async ({ report }) => (calls++, (report({ inputTokens: 1 }), { ok: true })) },
      gate
    );
    const second = await accounting.execute(
      { ...envelope, run: async () => (calls++, { ok: false }) },
      gate
    );
    expect([first, second]).toEqual([{ ok: true }, { ok: true }]);
    expect(calls).toBe(1);
  });
});

describe('LM service call paths', () => {
  it('every awaited call path bills spend and records stats through the one envelope', async () => {
    const service = createLMService();
    const chunks: string[] = [];
    await service.generateText('account the text path');
    for await (const chunk of service.stream('account the stream path')) chunks.push(chunk);

    expect(chunks.join('')).not.toBe('');
    const stats = service.getStats();
    expect(stats.totalCalls).toBe(2);
    expect(stats.successfulCalls).toBe(2);
    expect(stats.failedCalls).toBe(0);
    expect(Object.values(service.getSpend())[0]?.calls).toBe(2);
  });

  it('a repeated prompt is served from the cache without a second transport call', async () => {
    const service = createLMService();
    await service.generateText('cache me');
    const before = service.getStats().totalCalls;
    await service.generateText('cache me');
    expect(service.getStats().totalCalls).toBe(before + 1);
  });
});
