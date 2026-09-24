import { describe, expect, it } from 'vitest';
import { selectProbes } from '@senars/nar/dialogue';
import type { CurriculumSource } from '@senars/nar/dialogue';
import type { Episode } from '@senars/util';

/**
 * TODO25 Bench 79 — Phase C falsifier: curriculum probe selection. Gate (N3):
 * probes derive only from graded data, carry digests/ids never raw text (I6),
 * are deterministic for the same data, deduped with corrections winning, and
 * bounded. Frozen-eval rows are structurally absent (I1 — reaction sources
 * are excluded there by construction).
 */
const reaction = (turnId: string, kind: string): Episode =>
  ({ type: 'reaction', content: JSON.stringify({ turnId, kind }), metadata: { turnId, kind }, timestamp: 0 }) as Episode;

const source = (reactions: Episode[], grades: Record<string, number>): CurriculumSource => ({
  reactions: async () => reactions,
  grades: () => new Map(Object.entries(grades)),
});

describe('TODO25 Bench 79 — selectProbes', () => {
  it('corrections rank first; low-grade turns follow; selection is bounded', async () => {
    const probes = await selectProbes(
      source(
        [reaction('t-c1', 'correct'), reaction('t-c2', 'correct'), reaction('t-ok', 'accept')],
        { 'g-low1': 0.2, 'g-low2': 0.4, 'g-high': 0.9 }
      ),
      { limit: 3 }
    );
    expect(probes.map((p) => p.kind)).toEqual(['correction', 'correction', 'low-grade']);
    expect(probes.every((p) => p.id !== 'g-high' && p.id !== 't-ok')).toBe(true);
  });

  it('deterministic: same data ⇒ identical selection, digest tie-break on equal scores', async () => {
    const grades = { 'b': 0.1, 'a': 0.1, 'c': 0.1 };
    const run = () => selectProbes(source([], grades), { limit: 10 });
    const [r1, r2] = await Promise.all([run(), run()]);
    expect(r1).toEqual(r2);
    expect(r1.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('dedup: a corrected turn is not duplicated as a low-grade probe (correction wins)', async () => {
    const probes = await selectProbes(
      source([reaction('dup:1', 'correct')], { 'dup:1': 0.1, 'other:1': 0.1 }),
      { limit: 10 }
    );
    expect(probes.filter((p) => p.id === 'dup:1').map((p) => p.kind)).toEqual(['correction']);
  });

  it('I6: probes carry ids/scores only — no raw text fields exist on Probe rows', async () => {
    const probes = await selectProbes(source([reaction('t-x', 'correct')], {}));
    for (const p of probes) expect(Object.keys(p).sort()).toEqual(['id', 'kind', 'score']);
  });

  it('empty data ⇒ empty selection', async () => {
    expect(await selectProbes(source([], {}))).toEqual([]);
  });
});
