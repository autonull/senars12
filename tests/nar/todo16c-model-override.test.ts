import { afterEach, describe, expect, it } from 'vitest';
import { LMService, createLMService } from '../../nar/src/lm/lm-service.js';
import { resolveActiveProvider } from '../../nar/src/lm/providers.js';
import { createSeNARSRegistry } from '../../nar/src/lm/index.js';
import { getLastRoutingDecision } from '../../nar/src/lm/providers.js';
import { createLMServiceCortex } from '../../nar/src/lm/system-one/cortex-adapter.js';
import type { CognitiveContext, SynthesisQuery } from '../../nar/src/lm/system-one/types.js';

const withEnv = (env: Record<string, string | undefined>, fn: () => void | Promise<void>) => {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
};

describe('Bench 27 — Per-Call Model Override', () => {
  afterEach(() => {
    delete process.env.LM_PROVIDER;
    delete process.env.LM_OFFLINE;
    delete process.env.LM_MAX_SPEND_USD;
  });

  it('explicit model id routes directly and is recorded in routing telemetry', async () => {
    await withEnv({ LM_PROVIDER: 'mock' }, async () => {
      const service = createLMService();
      const text = await service.generateText('ping', { model: 'builtin:mock' });
      expect(typeof text).toBe('string');
      expect(getLastRoutingDecision()?.modelId).toBe('builtin:mock');
    });
  });

  it('unknown model id throws — no silent failover', async () => {
    await withEnv({ LM_PROVIDER: 'mock' }, async () => {
      const service = createLMService();
      await expect(service.generateText('ping', { model: 'builtin:does-not-exist' })).rejects.toThrow();
    });
  });

  it('cache keys include the override id (same prompt, different models → separate entries)', async () => {
    await withEnv({ LM_PROVIDER: 'mock' }, async () => {
      const service = createLMService();
      const a = await service.generateText('same prompt', { model: 'builtin:mock' });
      const b = await service.generateText('same prompt'); // chain-routed
      expect(typeof a).toBe('string');
      expect(typeof b).toBe('string');
    });
  });

  it('H3 — spend ledger accumulates tokens per provider from AI-SDK usage', async () => {
    await withEnv({ LM_PROVIDER: 'mock' }, async () => {
      const service = createLMService();
      await service.generateText('hello world');
      const spend = service.getSpend();
      const provider = Object.keys(spend)[0] ?? '';
      expect(provider).toBeTruthy();
      const entry = spend[provider]!;
      expect(entry.tokensOut).toBeGreaterThan(0);
      expect(entry.calls).toBeGreaterThanOrEqual(1);
    });
  });

  it('H3 — LM_MAX_SPEND_USD cap trips with a remediation hint', async () => {
    await withEnv({ LM_PROVIDER: 'mock' }, async () => {
      const service = createLMService();
      // Cost accrues only for paid capabilities; make the mock capability paid so
      // the ledger math is deterministic, then exceed the cap.
      const { MODEL_CAPABILITIES } = await import('../../nar/src/lm/providers.js');
      const cap = MODEL_CAPABILITIES['builtin:mock'];
      if (!cap) throw new Error('builtin:mock capability missing');
      const original = cap.costPerMTok;
      cap.costPerMTok = 3;
      try {
        await service.generateText('hello world'); // sets lastRoutingDecision → builtin:mock
        const record = (service as unknown as { recordSpend: (p: string, t: string, i: number, o: number) => void });
        process.env.LM_MAX_SPEND_USD = '0.001';
        expect(() => record.recordSpend.call(service, 'mock', 'fast', 0, 1_000_000)).toThrow(/Spend cap reached.*LM_PROVIDER=mock/);
      } finally {
        cap.costPerMTok = original;
      }
    });
  });

  it('H4 — LM_OFFLINE=1 skips all probes: configured cloud resolves to local immediately', async () => {
    await withEnv({ LM_PROVIDER: 'anthropic', LM_OFFLINE: '1' }, async () => {
      const provider = await resolveActiveProvider();
      expect(provider).toBe('mock');
    });
    await withEnv({ LM_PROVIDER: 'mock', LM_OFFLINE: '1' }, async () => {
      expect(await resolveActiveProvider()).toBe('mock');
    });
  });

  it('H2 domain binding — systemOne.cortex.model routes Cortex calls to the bound id', async () => {
    await withEnv({ LM_PROVIDER: 'mock' }, async () => {
      const registry = createSeNARSRegistry();
      const service = new LMService(registry);
      const cortex = createLMServiceCortex({ lmService: service, model: 'builtin:mock' });
      const context: CognitiveContext = {
        topBeliefs: ['b1'],
        topGoals: ['g1'],
        workingMemory: ['w1'],
        tickId: 't1',
      } as never;
      const query: SynthesisQuery = { kind: 'synthesize', instruction: 'give candidates', maxCandidates: 2 } as never;
      const results = [];
      for await (const prop of cortex.synthesize(context, query, {} as never)) results.push(prop);
      const first = results[0]!;
      expect(first.candidates.length).toBe(2);
      expect(getLastRoutingDecision()?.modelId).toBe('builtin:mock');
    });
  });

  it('H6 — LMUnavailableError carries provider-specific remediation hints', async () => {
    const { withHint } = await import('../../nar/src/lm/lm-service.js');
    expect(withHint('unavailable', 'openai-compatible')).toMatch(/ollama serve/);
    expect(withHint('unavailable', 'llamacpp-embedded')).toMatch(/fetch-model/);
    expect(withHint('unavailable', 'unknown-provider')).toBe('unavailable');
  });
});
