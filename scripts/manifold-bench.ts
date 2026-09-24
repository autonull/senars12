/**
 * AC #14 (TODO22): enhanced manifold ≤20ms/judgment @100 candidates (vs ~33ms baseline).
 *
 * Baseline leg: raw manifold judgeBatch (uncalibrated heads, pass-through).
 * Enhanced leg: judgeBatch + CLM contrastive scoring per candidate via the
 * shared ContrastiveMemory (calibrated InfoNCE over frozen embeddings) — the
 * additive work the runtime actually performs in gate/grader/reflex paths.
 *
 * Usage: pnpm bench:manifold  (mock embedding generator — CI-safe, deterministic)
 */
import { createContrastiveMemory } from '../nar/src/lm/system-one/contrastive.js';
import { createEmbeddingCache } from '../nar/src/lm/system-one/embedding-cache.js';
import { createManifold } from '../nar/src/lm/system-one/manifold.js';
import type { JudgmentQuery } from '../nar/src/lm/system-one/types.js';

const CANDIDATES = Number(process.env.BENCH_CANDIDATES ?? 100);
const DIM = 384;

/** Deterministic bag-of-words directional embeddings (see tests/nar/todo22-contrastive.test.ts). */
const directional = (text: string): Float32Array => {
  const v = new Float32Array(DIM);
  for (const word of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    const seed = word.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7);
    for (let i = 0; i < DIM; i++) v[i]! += Math.sin(seed * 0.1 + i);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
};

const POSITIVE = 'verified grounded factual statement consistent with prior beliefs';
const NEGATIVE = 'hallucinated unverifiable claim contradicting known episode outcomes';

const budget = {
  maxCycles: 100, maxDepth: 10, maxMemoryOps: 1000, maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const evaluateQuery = (i: number): JudgmentQuery => ({
  kind: 'evaluate',
  instruction: `Evaluate candidate ${i}`,
  rubric: 'groundedness' as never,
  axis: 'epistemic',
});

const warmup = async (fn: () => Promise<void>, rounds = 3): Promise<void> => {
  for (let i = 0; i < rounds; i++) await fn();
};

const bench = async (fn: () => Promise<void>, rounds = 10): Promise<number> => {
  await warmup(fn);
  const start = performance.now();
  for (let i = 0; i < rounds; i++) await fn();
  return (performance.now() - start) / (rounds * CANDIDATES);
};

const main = async (): Promise<void> => {
  const cache = createEmbeddingCache({
    maxSize: 4 * CANDIDATES,
    generator: { generate: async (text: string) => [...directional(text)] },
  });

  const candidates = Array.from({ length: CANDIDATES }, (_, i) =>
    i % 2 === 0 ? `${POSITIVE} variant ${i}` : `${NEGATIVE} variant ${i}`
  );
  const pointers = await Promise.all(candidates.map((c) => cache.write(c)));
  const queries = candidates.map((_, i) => evaluateQuery(i));

  const manifold = createManifold(cache);
  const baselinePerJudgment = await bench(async () => {
    await Promise.all(pointers.map((p, i) => manifold.judgeBatch(p, [queries[i]!], budget)));
  });

  // Enhanced leg: calibrated contrastive memory over the same frozen embeddings.
  const contrastive = createContrastiveMemory();
  await contrastive.add('groundedness', {
    positives: Array.from({ length: 16 }, (_, i) => `${POSITIVE} exemplar ${i}`),
    negatives: Array.from({ length: 16 }, (_, i) => `${NEGATIVE} exemplar ${i}`),
  }, cache);
  contrastive.calibrateAll();

  const enhancedPerJudgment = await bench(async () => {
    await Promise.all(pointers.map(async (p, i) => {
      await manifold.judgeBatch(p, [queries[i]!], budget);
      contrastive.score(cache.read(p)!, 'groundedness');
    }));
  });

  const pass = enhancedPerJudgment <= 20;
  const report = [
    `Manifold bench: ${CANDIDATES} candidates, dim=${DIM}`,
    `  baseline (judgeBatch):            ${baselinePerJudgment.toFixed(3)} ms/judgment`,
    `  enhanced (judgeBatch + contrast): ${enhancedPerJudgment.toFixed(3)} ms/judgment`,
    `  overhead: ${(enhancedPerJudgment - baselinePerJudgment).toFixed(3)} ms/judgment`,
    `  AC #14 gate (≤20ms/judgment @${CANDIDATES} candidates): ${pass ? 'PASS' : 'FAIL'}`,
  ];
  console.log(report.join('\n'));
  if (!pass) process.exitCode = 1;
};

await main();
