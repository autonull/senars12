import type { CeilingReputation, SourceQuality } from '@senars/schemas';
import { Truth } from '../../terms/impls/Truth';
import type { Desire } from './desire';
import type { JudgmentProposition } from './types';
/** Rolling-ECE → calibration authority. Better calibration ⇒ more authority, never above ceiling. */
export declare function calibrateAuthority(rollingEce: number): number;
/** Epistemic: seeds belief-side Truth. Ceiling = kernel source-quality table, optionally
 *  lowered by the source's reputation track record (Phase E — trust-not-truth, C2). */
export declare function seedTruth(p: JudgmentProposition, sourceQuality?: SourceQuality, reputation?: CeilingReputation, sourceKey?: string): Truth;
/** Teleological: identical math, goal-side storage target. Callers MUST inject as type 'goal'. */
export declare function seedDesire(p: JudgmentProposition, sourceQuality?: SourceQuality): Desire;
//# sourceMappingURL=seed.d.ts.map