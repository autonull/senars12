import type { SourceQuality } from '@senars/kernel/schemas';
import { SOURCE_QUALITY_CONFIDENCE } from '@senars/kernel/schemas';
import { Truth } from '../../terms/truth.js';
import type { Desire } from './desire.js';
import type { JudgmentProposition } from './types.js';

/** Rolling-ECE → calibration authority. Better calibration ⇒ more authority, never above ceiling. */
export function calibrateAuthority(rollingEce: number): number {
  if (rollingEce < 0.05) return 0.6;
  if (rollingEce < 0.1) return 0.55;
  return 0.5;
}

/** Epistemic: seeds belief-side Truth. Ceiling = kernel source-quality table, optionally
 *  lowered by the source's reputation track record (Phase E — trust-not-truth, C2). */
export function seedTruth(
  p: JudgmentProposition,
  sourceQuality: SourceQuality = 'LLM_PRIOR',
  reputation?: { effectiveCeiling(base: number, key: string): number },
  sourceKey?: string
): Truth {
  const base = SOURCE_QUALITY_CONFIDENCE[sourceQuality];
  const ceiling = reputation && sourceKey ? reputation.effectiveCeiling(base, sourceKey) : base;
  const authority = calibrateAuthority(p.calibration.ece);
  const f = p.kind === 'evaluate' ? p.score : p.top.p;
  return Truth.create(f, Math.min(authority, ceiling, Truth.MAX_CONFIDENCE));
}

/** Teleological: identical math, goal-side storage target. Callers MUST inject as type 'goal'. */
export function seedDesire(
  p: JudgmentProposition,
  sourceQuality: SourceQuality = 'LLM_PRIOR'
): Desire {
  return seedTruth(p, sourceQuality);
}
