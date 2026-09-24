import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EpisodicMemory } from '../../nar/src/memory/EpisodicMemory.js';
import { DigestMismatchError } from '../../nar/src/lm/system-one/wasi-runtime.js';
import {
  extractLessons,
  loadRetrospectives,
  persistRetrospective,
  retrospect,
} from '../../nar/src/dialogue/retrospect.js';
import { DialogueCapture } from '../../nar/src/dialogue/capture.js';
import { InMemoryEpisodicMemory } from '../utils/in-memory-episodic.js';

const makeEpisodic = async () =>
  new EpisodicMemory({
    enabled: true,
    basePath: join(await mkdtemp(join(tmpdir(), 'todo24-retro-')), 'episodes'),
    retentionDays: 1,
    maxEntriesPerFile: 100,
  });

/** Seed a session: ≥10 turns, ≥2 reactions (minimum viable session). */
const seedSession = async (ep: EpisodicMemory, sessionId: string): Promise<DialogueCapture> => {
  const d = new DialogueCapture({ episodic: ep, config: { enabled: true } });
  const ids: string[] = [];
  for (let i = 0; i < 12; i++) {
    ids.push(
      (await d.onExchange({
        correlationId: sessionId,
        utterance: `u${i}`,
        response: `r${i}`,
        grounding: { admitted: true, score: 0.8 },
      }))!
    );
  }
  await d.bindReaction(ids[2]!, 'correct', 'I meant X');
  await d.bindReaction(ids[5]!, 'accept');
  await d.bindReaction(ids[8]!, 'accept');
  return d;
};

describe('TODO24 bench 73: retrospect diagnostic', () => {
  it('seeded session yields turn summary, reaction distribution, correction analysis, strategy audit', async () => {
    const ep = await makeEpisodic();
    await seedSession(ep, 'sess-1');
    const r = await retrospect('sess-1', ep, {
      traceGrades: new Map([['sess-2', 0.9]]),
      contradictionTerms: ['<a --> b>'],
      proposals: [{ proposalId: '00000000-0000-4000-8000-000000000000', kind: 'focus-weight', riskTier: 'low', payload: {}, rewardDomain: 'epistemic' }],
    });
    expect(r.version).toBe('retrospective-v1');
    expect(r.sessionId).toBe('sess-1');
    expect(r.turnCount).toBe(12);
    expect(r.reactionCount).toBe(3);
    expect(r.reactionDistribution).toEqual({ accept: 2, correct: 1, reject: 0, clarify: 0, redirect: 0, abandon: 0 });
    expect(r.corrections).toHaveLength(1);
    expect(r.corrections[0]!.correctionDigest).toMatch(/^sha256:/);
    expect(r.corrections[0]!.originalDigest).toMatch(/^sha256:/);
    expect(r.strategyAudit).toHaveLength(1);
    expect(r.strategyAudit[0]!.gradedTurns).toBe(12);
    expect(r.provenance.turnIds).toHaveLength(12);
    expect(r.digest).toMatch(/^sha256:/);
  });

  it('sub-threshold session yields a skeleton (no strategy audit, no contradictions)', async () => {
    const ep = await makeEpisodic();
    const d = new DialogueCapture({ episodic: ep, config: { enabled: true } });
    await d.onExchange({ correlationId: 'tiny', utterance: 'u', response: 'r' });
    const r = await retrospect('tiny', ep, { contradictionTerms: ['<x --> y>'] });
    expect(r.turnCount).toBe(1);
    expect(r.strategyAudit).toHaveLength(0);
    expect(r.contradictions).toHaveLength(0);
  });

  it('persists digest-pinned JSONL; corrupted artifact fails closed', async () => {
    const ep = await makeEpisodic();
    await seedSession(ep, 'sess-2');
    const r = await retrospect('sess-2', ep);
    await persistRetrospective(r);
    const loaded = await loadRetrospectives();
    expect(loaded.some((x) => x.sessionId === 'sess-2')).toBe(true);

    await persistRetrospective({ ...r, sessionId: 'tampered' });
    const all = await loadRetrospectives();
    expect(all[all.length - 1]!.sessionId).toBe('tampered');
    // Tamper with the digest pin of the last row.
    const { promises: fs } = await import('node:fs');
    const path = join('.cache/retrospectives', 'retrospectives.jsonl');
    const content = await fs.readFile(path, 'utf-8');
    await fs.writeFile(path, content.replace(/"digest":"sha256:[a-f0-9]+"/, '"digest":"sha256:0000"'));
    await expect(loadRetrospectives()).rejects.toThrow(DigestMismatchError);
    await fs.rm('.cache/retrospectives', { recursive: true, force: true });
  });

  it('lessons require ≥2 supporting turns and confidence above the admission floor', () => {
    const lesson = {
      term: '<good --> response>',
      truth: { frequency: 0.9, confidence: 0.6 },
    };
    const full = {
      reactionDistribution: { accept: 2, correct: 0, reject: 0, clarify: 0, redirect: 0, abandon: 0 },
      provenance: { turnIds: ['t1', 't2'] },
    } as unknown as Parameters<typeof extractLessons>[0];
    expect(extractLessons(full, lesson)).toHaveLength(1);
    expect(extractLessons(full, { ...lesson, truth: { frequency: 0.9, confidence: 0.3 } })).toHaveLength(0);
    expect(extractLessons({ ...full, reactionDistribution: { ...full.reactionDistribution, accept: 1 } }, lesson)).toHaveLength(0);
  });
});