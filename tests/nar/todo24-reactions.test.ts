import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import { createFrozenEvalSet } from '../../nar/src/lm/system-one/eval-set.js';
import { recordReactionLabel } from '../../nar/src/lm/system-one/label-sources.js';
import { DialogueCapture, sha256 } from '../../nar/src/dialogue/capture.js';
import { REACTION_KINDS } from '../../nar/src/dialogue/types.js';
import { InMemoryEpisodicMemory } from '../utils/in-memory-episodic.js';

const embed = async (text: string): Promise<number[]> => Array.from({ length: 8 }, (_, i) => (text.charCodeAt(i % text.length) % 7) / 7);
const cache = () => createEmbeddingCache({ generator: { generate: embed }, dimension: 8 });

function newDataset() {
  const tmp = mkdtempSync(join(tmpdir(), 's1-reactions-'));
  return new JudgmentDataset(tmp);
}

describe('TODO24 bench 71: reaction labels + exclusions + redaction', () => {
  it('correct yields a two-row preference pair (observed 0/1, REACTION_SOURCE)', async () => {
    const dataset = newDataset();
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
    const dataset = newDataset();
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
    const dataset = newDataset();
    const d = new DialogueCapture({ dataset, config: { enabled: true } });
    const turnId = await d.onExchange({ correlationId: 's', utterance: 'q', response: 'r' });
    await d.bindReaction(turnId!, 'clarify');
    await d.bindReaction(turnId!, 'redirect');
    expect(dataset.all()).toHaveLength(0);
    const dataset2 = newDataset();
    const d2 = new DialogueCapture({ dataset: dataset2, config: { enabled: true } });
    const t2 = await d2.onExchange({ correlationId: 's', utterance: 'q', response: 'r' });
    await d2.bindReaction(t2!, 'accept');
    await d2.bindReaction(t2!, 'accept');
    expect(dataset2.all()).toHaveLength(1);
  });

  it('createFrozenEvalSet default-excludes REACTION_SOURCE (I1)', () => {
    const dataset = newDataset();
    dataset.record({ evidenceId: 'e1', rubric: 'groundedness', axis: 'epistemic', label: 'x', score: 0.9, observed: 1, source: 'label' });
    dataset.record({ evidenceId: 'e2', rubric: 'groundedness', axis: 'epistemic', label: 'x', score: 0.4, observed: 0, source: 'reaction' });
    dataset.record({ evidenceId: 'e3', rubric: 'groundedness', axis: 'epistemic', label: 'x', score: 0.4, observed: 0, source: 'conversation' });
    const set = createFrozenEvalSet(dataset);
    expect(set.rows).toHaveLength(1);
  });

  it('no raw correction text appears in any persisted row (I6)', async () => {
    const dataset = newDataset();
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

  it('text retention off by default; opting in writes only the sidecar (I6 scoping)', async () => {
    const { DialogueTextStore } = await import('../../nar/src/dialogue/text-store.js');
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const textDir = join(await mkdtemp(join(tmpdir(), 'todo24-text-')), 'text');

    // Default: hash-only — no sidecar, no raw text anywhere.
    const dataset0 = newDataset();
    const d0 = new DialogueCapture({ dataset: dataset0, config: { enabled: true } });
    expect(d0.textStore).toBeUndefined();
    const t0 = await d0.onExchange({ correlationId: 's', utterance: 'PLAIN-TEXT', response: 'r' });
    expect(JSON.stringify(d0.getTurn(t0!))).not.toContain('PLAIN-TEXT');

    // Opt-in: sidecar gets the raw text; labels stay hash-only.
    const dataset = newDataset();
    const d = new DialogueCapture({
      dataset,
      embeddingCache: cache(),
      config: { enabled: true, retention: 'with-text', textStorePath: textDir },
    });
    expect(d.textStore).toBeDefined();
    const turnId = await d.onExchange({ correlationId: 's', utterance: 'hello there', response: 'hi friend' });
    await d.bindReaction(turnId!, 'correct', 'the actual fix');
    const records = await d.textStore!.read();
    expect(records).toHaveLength(1);
    expect(records[0]!.utterance).toBe('hello there');
    expect(records[0]!.response).toBe('hi friend');
    expect(records[0]!.correction).toBe('the actual fix');
    // Labels + turn remain hash-only even in text mode.
    expect(JSON.stringify(dataset.all())).not.toContain('the actual fix');
    expect(JSON.stringify(d.getTurn(turnId!))).not.toContain('hello there');
    // get() joins by turnId; purge removes everything.
    expect((await d.textStore!.get(turnId!))!.correction).toBe('the actual fix');
    expect(new DialogueTextStore(textDir)).toBeDefined();
    await d.textStore!.purge();
    expect(await d.textStore!.read()).toHaveLength(0);
    void DialogueTextStore;
  });

  it('disabled path is byte-identical: no capture, no labels, no episodes', async () => {
    const dataset = newDataset();
    const episodic = new InMemoryEpisodicMemory();
    const d = new DialogueCapture({ dataset, episodic, config: { enabled: false } });
    expect(await d.onExchange({ correlationId: 's', utterance: 'q', response: 'r' })).toBeUndefined();
    await d.bindReaction('missing', 'accept');
    expect(dataset.all()).toHaveLength(0);
    expect(episodic.episodes).toHaveLength(0);
  });
});