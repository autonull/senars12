import type { SourceQuality } from '@senars/kernel/schemas';
import { SOURCE_QUALITY_CONFIDENCE } from '@senars/kernel/schemas';
import { Truth } from '../../terms/truth.js';
import type { JudgmentProposition } from './types.js';
import type { Desire } from './desire.js';

/** Rolling-ECE → calibration authority. Better calibration ⇒ more authority, never above ceiling. */
export function calibrateAuthority(rollingEce: number): number {
  if (rollingEce < 0.05) return 0.6;
  if (rollingEce < 0.10) return 0.55;
  return 0.5;
}

/** Epistemic: seeds belief-side Truth. Ceiling = kernel source-quality table. */
export function seedTruth(p: JudgmentProposition, sourceQuality: SourceQuality = 'LLM_PRIOR'): Truth {
  const ceiling = SOURCE_QUALITY_CONFIDENCE[sourceQuality];
  const authority = calibrateAuthority(p.calibration.ece);
  const f = p.kind === 'evaluate' ? p.score : p.top.p;
  return Truth.create(f, Math.min(authority, ceiling, Truth.MAX_CONFIDENCE));
}

/** Teleological: identical math, goal-side storage target. Callers MUST inject as type 'goal'. */
export function seedDesire(p: JudgmentProposition, sourceQuality: SourceQuality = 'LLM_PRIOR'): Desire {
  return seedTruth(p, sourceQuality);
}