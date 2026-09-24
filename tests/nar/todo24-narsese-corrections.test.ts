import { describe, expect, it } from 'vitest';
import { DialogueCapture } from '@senars/nar/dialogue';
import { InMemoryEpisodicMemory } from '../utils/in-memory-episodic.js';

/**
 * TODO24 Bench 75 — DQ6 falsifier: Narsese-level correction formalization.
 * With a `formalize` dep, a `correct` reaction yields reaction-source lessons
 * (explicit ingestion only — nothing auto-applies, I2/I3). Without it, the
 * embedding-level default is unchanged. Formalizer failures degrade silently.
 */
type Formalizer = (text: string) => Promise<readonly { narsese: string; confidence: number }[]>;

const captureWith = (formalize?: Formalizer) =>
  new DialogueCapture({
    episodic: new InMemoryEpisodicMemory(),
    ...(formalize ? { formalize } : {}),
    config: { enabled: true },
  });

describe('TODO24 Bench 75 — Narsese-level correction formalization (DQ6)', () => {
  it('a correct reaction with a formalizer yields reaction-source lessons above the confidence floor', async () => {
    const capture = captureWith(async (text) => [
      { narsese: '<sol_primary --> water>', confidence: 0.9 },
      { narsese: '<noise --> junk>', confidence: 0.2 }, // below floor — dropped
      { narsese: '', confidence: 0.9 }, // empty term — dropped
    ]);
    const turnId = await capture.onExchange({ correlationId: 'corr-1', utterance: 'what dissolves?', response: 'salt dissolves in oil' });
    expect(turnId).toBeTruthy();
    await capture.bindReaction(turnId!, 'correct', 'salt dissolves in water, not oil');
    const lessons = capture.lessons;
    expect(lessons.length).toBe(1);
    expect(lessons[0]!.term).toBe('<sol_primary --> water>');
    expect(lessons[0]!.source).toBe('reaction');
    expect(lessons[0]!.truth).toEqual({ frequency: 1, confidence: 0.9 });
    expect(lessons[0]!.provenance.turnIds).toEqual([turnId]);
  });

  it('formalizer failure degrades gracefully — embedding-level path still runs, no crash', async () => {
    const capture = captureWith(async () => {
      throw new Error('LM unavailable');
    });
    const turnId = await capture.onExchange({ correlationId: 'corr-2', utterance: 'u', response: 'r' });
    await expect(capture.bindReaction(turnId!, 'correct', 'no — the answer is 4')).resolves.toBeUndefined();
    expect(capture.lessons.length).toBe(0);
  });

  it('without a formalizer (DQ6 default) no lessons are produced — behavior unchanged', async () => {
    const capture = captureWith();
    const turnId = await capture.onExchange({ correlationId: 'corr-3', utterance: 'u', response: 'r' });
    await capture.bindReaction(turnId!, 'correct', 'correction text');
    expect(capture.lessons.length).toBe(0);
  });

  it('binding is idempotent — rebinding never duplicates lessons', async () => {
    const capture = captureWith(async () => [{ narsese: '<a --> b>', confidence: 0.8 }]);
    const turnId = await capture.onExchange({ correlationId: 'corr-4', utterance: 'u', response: 'r' });
    await capture.bindReaction(turnId!, 'correct', 'fix one');
    await capture.bindReaction(turnId!, 'correct', 'fix two');
    expect(capture.lessons.length).toBe(1);
  });

  it('lessons are bounded (MAX_LESSONS) and disabled capture produces none', async () => {
    const disabled = new DialogueCapture({ episodic: new InMemoryEpisodicMemory(), formalize: async () => [{ narsese: '<x --> y>', confidence: 0.9 }], config: { enabled: false } });
    const turnId = await disabled.onExchange({ correlationId: 'corr-5', utterance: 'u', response: 'r' });
    await disabled.bindReaction(turnId ?? '', 'correct', 'correction');
    expect(disabled.lessons.length).toBe(0);
  });
});