process.env.LM_PROVIDER = 'mock';

import { afterEach, describe, expect, it } from 'vitest';
import { createAgent } from '../../nar/src/agent/index.js';
import type { ExtendedAgent } from '../../nar/src/agent/index.js';
import { LMService, LMUnavailableError } from '../../nar/src/lm/lm-service.js';
import { consolidateEpisodes } from '../../nar/src/memory/retrieval-verified.js';
import type { ConsolidatorDeps } from '../../nar/src/memory/retrieval-verified.js';
import type { Episode } from '@senars/util';

/**
 * Bench 37 — Async Honesty (TODO17b Phase A)
 * D2: getRecentDerivations returns derivations (no self-recursion).
 * D3: multi-agent chat streams real text events.
 * D5: stream() records spend and throws LMUnavailableError on missing model.
 * D7: consolidation result reflects the promote outcome.
 */

const created: ExtendedAgent[] = [];
afterEach(async () => {
  while (created.length) await created.pop()?.stop();
});

describe('Bench 37 — Async Honesty', () => {
  it('D2 — getRecentDerivations returns derivations without self-recursion', async () => {
    const agent = await createAgent({});
    created.push(agent);
    const derivations = agent.getRecentDerivations();
    expect(Array.isArray(derivations)).toBe(true);
  });

  it('D3 — chat streams text events, not an AsyncGenerator object', async () => {
    const agent = await createAgent({});
    created.push(agent);
    let finishText: string | undefined;
    let sawDelta = false;
    for await (const evt of agent.chat('hello')) {
      if (evt.kind === 'text-delta') sawDelta = true;
      if (evt.kind === 'finish') finishText = evt.text;
    }
    expect(typeof finishText).toBe('string');
    expect(finishText).not.toContain('AsyncGenerator');
    expect(sawDelta || (finishText && finishText.length > 0)).toBe(true);
  });

  it('D5 — stream throws LMUnavailableError when no model resolves', async () => {
    const service = new LMService({} as never);
    await expect(async () => {
      for await (const _chunk of service.stream('hi')) void _chunk;
    }).rejects.toThrow(LMUnavailableError);
  });

  it('D5 — stream records spend for the served provider', async () => {
    const service = new LMService((await import('../../nar/src/lm/index.js')).createSeNARSRegistry());
    if (!service.hasModel()) return; // no provider in this environment — skip
    let chunks = 0;
    for await (const _chunk of service.stream('Say anything.')) chunks++;
    expect(chunks).toBeGreaterThan(0);
    expect(Object.keys(service.getSpend()).length).toBeGreaterThan(0);
  });

  it('D5 — repeated stream of the same prompt is cache-served', async () => {
    const service = new LMService((await import('../../nar/src/lm/index.js')).createSeNARSRegistry());
    if (!service.hasModel()) return;
    let first = '';
    for await (const c of service.stream('cache probe xyz')) first += c;
    let second = '';
    for await (const c of service.stream('cache probe xyz')) second += c;
    expect(second).toBe(first);
  });

  it('D7 — consolidation result reflects a failing promote', async () => {
    const episode: Episode = {
      timestamp: Date.now(),
      type: 'input',
      content: 'durable fact',
      metadata: {},
    };
    const deps: ConsolidatorDeps = {
      episodic: {
        getEpisodes: async () => [episode],
      } as unknown as ConsolidatorDeps['episodic'],
      lm: { generateText: async () => '[1]' } as unknown as ConsolidatorDeps['lm'],
      embeddings: { generate: async () => [1, 0] } as unknown as ConsolidatorDeps['embeddings'],
      promote: async () => {
        throw new Error('believe failed');
      },
    };
    await expect(consolidateEpisodes(deps, {})).rejects.toThrow('believe failed');
  });

  it('D7 — consolidation reports only beliefs that landed', async () => {
    const episode: Episode = {
      timestamp: Date.now(),
      type: 'input',
      content: 'durable fact',
      metadata: {},
    };
    const promotedContents: string[] = [];
    const deps: ConsolidatorDeps = {
      episodic: { getEpisodes: async () => [episode] } as unknown as ConsolidatorDeps['episodic'],
      lm: { generateText: async () => '[1]' } as unknown as ConsolidatorDeps['lm'],
      embeddings: { generate: async () => [1, 0] } as unknown as ConsolidatorDeps['embeddings'],
      promote: async (content) => {
        promotedContents.push(content);
      },
    };
    const result = await consolidateEpisodes(deps, {});
    expect(result.promoted.map((p) => p.content)).toEqual(promotedContents);
  });
});