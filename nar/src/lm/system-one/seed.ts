import type { CeilingReputation, SourceQuality } from '@senars/core/schemas';
import { confidenceCeiling } from '@senars/core/schemas';
import { Truth } from '../../terms/impls/Truth.js';
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
  reputation?: CeilingReputation,
  sourceKey?: string
): Truth {
  const ceiling = confidenceCeiling(sourceQuality, {
    reputation,
    sourceKey,
    atMost: calibrateAuthority(p.calibration.ece),
  });
  const f = p.kind === 'evaluate' ? p.score : p.top.p;
  return Truth.normalize(f, ceiling);
}

/** Teleological: identical math, goal-side storage target. Callers MUST inject as type 'goal'. */
export function seedDesire(
  p: JudgmentProposition,
  sourceQuality: SourceQuality = 'LLM_PRIOR'
): Desire {
  return seedTruth(p, sourceQuality);
}
