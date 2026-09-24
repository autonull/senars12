import { describe, expect, it } from 'vitest';
import { EpisodicMemory } from '../../nar/src/memory/EpisodicMemory.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DialogueCapture } from '../../nar/src/dialogue/capture.js';

const makeEpisodic = async (): Promise<{ ep: EpisodicMemory; cleanup: () => Promise<void> }> => {
  const basePath = join(await mkdtemp(join(tmpdir(), 'todo24-')), 'episodes');
  return { ep: new EpisodicMemory({ enabled: true, basePath, retentionDays: 1, maxEntriesPerFile: 100 }), cleanup: () => Promise.resolve() };
};

describe('TODO24 bench 72: capture round-trip + correlation', () => {
  it('DialogueTurn round-trips to EpisodicMemory with provenance, joined by correlationId (I7)', async () => {
    const { ep } = await makeEpisodic();
    const d = new DialogueCapture({ episodic: ep, config: { enabled: true, maxTurnsPerSession: 500 } });
    const t1 = await d.onExchange({
      correlationId: 'corr-1',
      utterance: 'u1',
      response: 'r1',
      grounding: { admitted: true, score: 0.9 },
      provenance: { inputDigest: 'sha256:x', fitted: false, abstained: false, band: 'act', timestamp: 1 },
    });
    const t2 = await d.onExchange({ correlationId: 'corr-1', utterance: 'u2', response: 'r2' });
    const episodes = await ep.getEpisodes({ type: 'dialogue' });
    expect(episodes).toHaveLength(2);
    // getEpisodes returns newest-first; recompute from the full log
    const bySeq = [...episodes].sort((a, b) => JSON.parse(a.content).seq - JSON.parse(b.content).seq);
    const first = JSON.parse(bySeq[0]!.content) as { sessionId: string; turnId: string };
    const second = JSON.parse(bySeq[1]!.content) as { sessionId: string; turnId: string };
    expect(first.turnId).toBe(t1);
    expect(first.sessionId).toBe('corr-1');
    // I7: turnId = {correlationId}:{seq}; sessionId = first message's correlationId
    expect(second.turnId).toBe('corr-1:2');
    expect(second.sessionId).toBe('corr-1');
  });

  it('fan-out is idempotent per (sessionId, turnId)', async () => {
    const { ep } = await makeEpisodic();
    const d = new DialogueCapture({ dataset: undefined, episodic: ep, config: { enabled: true } });
    const turnId = await d.onExchange({ correlationId: 'c', utterance: 'u', response: 'r' });
    await d.bindReaction(turnId!, 'accept');
    await d.bindReaction(turnId!, 'reject'); // second bind ignored
    const reactions = await ep.getEpisodes({ type: 'reaction' });
    expect(reactions).toHaveLength(1);
    expect(JSON.parse(reactions[0]!.content).kind).toBe('accept');
  });

  it('bindReaction to a missing turn is a no-op (no synthetic turns)', async () => {
    const { ep } = await makeEpisodic();
    const d = new DialogueCapture({ episodic: ep, config: { enabled: true } });
    await d.bindReaction('nope:1', 'accept');
    expect((await ep.getEpisodes({ type: 'reaction' }))).toHaveLength(0);
  });

  it('maxTurnsPerSession bounds capture per AIKR', async () => {
    const d = new DialogueCapture({ config: { enabled: true, maxTurnsPerSession: 3 } });
    for (let i = 0; i < 5; i++) await d.onExchange({ correlationId: `c${i}`, utterance: 'u', response: 'r' });
    expect(d.config.maxTurnsPerSession).toBe(3);
    // capped session returns undefined beyond limit — seq never exceeds 3
    let captured = 0;
    for (let i = 0; i < 5; i++) captured += (await d.onExchange({ correlationId: 'fresh', utterance: 'u', response: 'r' })) ? 1 : 0;
    expect(captured).toBe(3);
  });

  it('enrich hook populates judgment/provenance; failures degrade to the base turn', async () => {
    const { ep } = await makeEpisodic();
    const d = new DialogueCapture({
      episodic: ep,
      config: { enabled: true },
      enrich: async () => ({
        judgment: { abstained: false, band: 'act' },
        provenance: { inputDigest: 'sha256:enriched', fitted: true, abstained: false, band: 'act', timestamp: 2 },
      }),
    });
    await d.onExchange({ correlationId: 'e', utterance: 'u', response: 'r' });
    expect(d.latestTurn()!.judgment).toEqual({ abstained: false, band: 'act' });
    expect(d.getTurn(d.latestTurn()!.turnId)!.provenance!.inputDigest).toBe('sha256:enriched');

    // Throwing enricher degrades to the base turn
    const d2 = new DialogueCapture({ config: { enabled: true }, enrich: async () => { throw new Error('boom'); } });
    const t = await d2.onExchange({ correlationId: 'c', utterance: 'u', response: 'r' });
    expect(t).toBeDefined();
    expect(d2.getTurn(t!)!.judgment).toBeUndefined();
  });
});
