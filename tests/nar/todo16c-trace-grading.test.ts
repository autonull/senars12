import { describe, it, expect } from 'vitest';
import {
  createTraceGrader,
} from '../../nar/src/lm/system-one/trace-grader.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';

function fakeGenerator(dimension = 384) {
  return {
    async generate(text: string): Promise<number[]> {
      const vec = new Array<number>(dimension).fill(0);
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
        vec[i % dimension] = ((h >>> 8) % 2000) / 1000 - 1;
      }
      return vec;
    },
  };
}

/** Manifold and grader must share ONE cache — pointers are cache-scoped (G4 invariant). */
const mkFixture = () => {
  const cache = createEmbeddingCache({ maxSize: 100, ttlMs: 60_000, generator: fakeGenerator() });
  const manifold = createManifold(cache, { abstainThreshold: 0.05 });
  return { cache, manifold };
};

describe('E4 trace grading (agent-trace observability)', () => {
  it('grades narration (groundedness) and executed tool calls (risk) through the manifold', async () => {
    const { cache, manifold } = mkFixture();
    manifold.registerHead({
      rubric: 'groundedness',
      axis: 'epistemic',
      fitted: true,
      evaluate: async (_ctx, query) => ({
        score: query.instruction.includes('grounded') ? 0.9 : 0.2,
        abstained: false,
      }),
    });
    manifold.registerHead({
      rubric: 'risk',
      axis: 'teleological',
      fitted: true,
      evaluate: async () => ({ score: 0.4, abstained: false }),
    });
    const grader = createTraceGrader({ manifold, embeddingCache: cache });

    const result = await grader({
      narration: 'I moved the file to the backup folder.',
      toolCalls: [
        { command: 'move_file', success: true },
        { command: 'rm_rf', success: false },
      ],
    });

    expect(result.groundedness).toBeDefined();
    expect(result.groundedness!.abstained).toBe(false);
    expect(result.groundedness!.score).toBeGreaterThanOrEqual(0);
    expect(result.risks).toHaveLength(2);
    expect(result.risks.map((r) => r.command)).toEqual(['move_file', 'rm_rf']);
    for (const r of result.risks) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.abstained).toBe(false);
    }
  });

  it('records hash-only dataset labels with observed = tool outcome; never raw text', async () => {
    const { cache, manifold } = mkFixture();
    manifold.registerHead({
      rubric: 'groundedness',
      axis: 'epistemic',
      fitted: true,
      evaluate: async () => ({ score: 0.85, abstained: false }),
    });
    manifold.registerHead({
      rubric: 'risk',
      axis: 'teleological',
      fitted: true,
      evaluate: async () => ({ score: 0.3, abstained: false }),
    });
    const dataset = new JudgmentDataset();
    const grader = createTraceGrader({ manifold, embeddingCache: cache, dataset, source: 'test' });

    const raw = 'secret utterance about dinosaurs';
    await grader({ narration: raw, toolCalls: [{ command: 'search', success: false }] });

    const labels = (dataset as unknown as { toJSONL(): string }).toJSONL();
    expect(labels).not.toContain(raw);
    const rows = labels
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { rubric: string; observed?: number; source: string });
    const grounded = rows.find((r) => r.rubric === 'groundedness');
    const risk = rows.find((r) => r.rubric === 'risk');
    expect(grounded).toBeDefined();
    expect(risk).toBeDefined();
    expect(risk!.observed).toBe(1); // failed tool ⇒ high-risk ground truth
    expect(risk!.source).toBe('test');
    expect(grounded!.observed).toBeUndefined(); // no narration ground truth at grade time
  });

  it('gradeless dataset (no dataset supplied) still returns grades without recording', async () => {
    const { cache, manifold } = mkFixture();
    manifold.registerHead({
      rubric: 'groundedness',
      axis: 'epistemic',
      fitted: true,
      evaluate: async () => ({ score: 0.7, abstained: false }),
    });
    const grader = createTraceGrader({ manifold, embeddingCache: cache });
    const result = await grader({ narration: 'plain narration', toolCalls: [] });
    expect(result.groundedness!.score).toBeGreaterThan(0);
    expect(result.risks).toHaveLength(0);
  });
});
