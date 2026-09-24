import { describe, expect, it } from 'vitest';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import { createFrozenEvalSet } from '../../nar/src/lm/system-one/eval-set.js';
import { recordReactionLabel } from '../../nar/src/lm/system-one/label-sources.js';
import { DialogueCapture, sha256 } from '../../nar/src/dialogue/capture.js';
import { REACTION_KINDS } from '../../nar/src/dialogue/types.js';
import { InMemoryEpisodicMemory } from '../utils/in-memory-episodic.js';

const embed = async (text: string): Promise<number[]> => Array.from({ length: 8 }, (_, i) => (text.charCodeAt(i % text.length) % 7) / 7);
const cache = () => createEmbeddingCache({ generator: { generate: embed }, dimension: 8 });

describe('TODO24 bench 71: reaction labels + exclusions + redaction', () => {
  it('correct yields a two-row preference pair (observed 0/1, REACTION_SOURCE)', async () => {
    const dataset = new JudgmentDataset();
    const d = new DialogueCapture({ dataset, embeddingCache: cache(), config: { enabled: true } });
    const turnId = await d.onExchange({ correlationId: 's1', utterance: 'hello', response: 'world' });
    await d.bindReaction(turnId!, 'correct', 'I meant something else');
    const rows = dataset.all().filter((r) => r.source === 'reaction');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.observed).sort()).toEqual([0, 1]);
    expect(rows.every((r) => r.rubric === 'groundedness')).toBe(true);
    expect(new Set(rows.map((r) => r.evidenceId)).size).toBe(2);
  });

  it('accept yields a positive label; reject yields a negative label', async () => {
    const dataset = new JudgmentDataset();
    const d = new DialogueCapture({ dataset, embeddingCache: cache(), config: { enabled: true } });
    const a = await d.onExchange({ correlationId: 's', utterance: 'q1', response: 'r1' });
    await d.bindReaction(a!, 'accept');
    const b = await d.onExchange({ correlationId: 's', utterance: 'q2', response: 'r2' });
    await d.bindReaction(b!, 'reject');
    const rows = dataset.all();
    expect(rows.find((r) => r.observed === 1)!.label).toBe('accepted');
    expect(rows.find((r) => r.observed === 0)!.label).toBe('rejected');
  });

  it('clarify/redirect produce no labels; binding is idempotent', async () => {
    const dataset = new JudgmentDataset();
    const d = new DialogueCapture({ dataset, config: { enabled: true } });
    const turnId = await d.onExchange({ correlationId: 's', utterance: 'q', response: 'r' });
    await d.bindReaction(turnId!, 'clarify');
    await d.bindReaction(turnId!, 'redirect');
    expect(dataset.all()).toHaveLength(0);
    const dataset2 = new JudgmentDataset();
    const d2 = new DialogueCapture({ dataset: dataset2, config: { enabled: true } });
    const t2 = await d2.onExchange({ correlationId: 's', utterance: 'q', response: 'r' });
    await d2.bindReaction(t2!, 'accept');
    await d2.bindReaction(t2!, 'accept');
    expect(dataset2.all()).toHaveLength(1);
  });

  it('createFrozenEvalSet default-excludes REACTION_SOURCE (I1)', () => {
    const dataset = new JudgmentDataset();
    dataset.record({ evidenceId: 'e1', rubric: 'groundedness', axis: 'epistemic', label: 'x', score: 0.9, observed: 1, source: 'label' });
    dataset.record({ evidenceId: 'e2', rubric: 'groundedness', axis: 'epistemic', label: 'x', score: 0.4, observed: 0, source: 'reaction' });
    dataset.record({ evidenceId: 'e3', rubric: 'groundedness', axis: 'epistemic', label: 'x', score: 0.4, observed: 0, source: 'conversation' });
    const set = createFrozenEvalSet(dataset);
    expect(set.rows).toHaveLength(1);
  });

  it('no raw correction text appears in any persisted row (I6)', async () => {
    const dataset = new JudgmentDataset();
    const d = new DialogueCapture({ dataset, embeddingCache: cache(), config: { enabled: true } });
    const turnId = await d.onExchange({ correlationId: 's', utterance: 'SECRET-UTTERANCE', response: 'SECRET-RESPONSE' });
    await d.bindReaction(turnId!, 'correct', 'SECRET-CORRECTION');
    const serialized = JSON.stringify(dataset.all()) + JSON.stringify(d.getTurn(turnId!));
    expect(serialized).not.toContain('SECRET-CORRECTION');
    expect(serialized).not.toContain('SECRET-UTTERANCE');
    expect(serialized).not.toContain('SECRET-RESPONSE');
    expect(d.getTurn(turnId!)!.utteranceDigest).toMatch(/^sha256:/);
    expect(sha256('x')).toMatch(/^sha256:/);
    expect(REACTION_KINDS).toHaveLength(6);
  });

  it('disabled path is byte-identical: no capture, no labels, no episodes', async () => {
    const dataset = new JudgmentDataset();
    const episodic = new InMemoryEpisodicMemory();
    const d = new DialogueCapture({ dataset, episodic, config: { enabled: false } });
    expect(await d.onExchange({ correlationId: 's', utterance: 'q', response: 'r' })).toBeUndefined();
    await d.bindReaction('missing', 'accept');
    expect(dataset.all()).toHaveLength(0);
    expect(episodic.episodes).toHaveLength(0);
  });
});