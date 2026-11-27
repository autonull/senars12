import { confidenceCeiling } from '@senars/schemas/truth';
import { Truth } from '../../terms/impls/Truth';
/** Rolling-ECE → calibration authority. Better calibration ⇒ more authority, never above ceiling. */
export function calibrateAuthority(rollingEce) {
    if (rollingEce < 0.05)
        return 0.6;
    if (rollingEce < 0.1)
        return 0.55;
    return 0.5;
}
/** Epistemic: seeds belief-side Truth. Ceiling = kernel source-quality table, optionally
 *  lowered by the source's reputation track record (Phase E — trust-not-truth, C2). */
export function seedTruth(p, sourceQuality = 'LLM_PRIOR', reputation, sourceKey) {
    const ceiling = confidenceCeiling(sourceQuality, {
        reputation,
        sourceKey,
        atMost: calibrateAuthority(p.calibration.ece),
    });
    const f = p.kind === 'evaluate' ? p.score : p.top.p;
    return Truth.normalize(f, ceiling);
}
/** Teleological: identical math, goal-side storage target. Callers MUST inject as type 'goal'. */
export function seedDesire(p, sourceQuality = 'LLM_PRIOR') {
    return seedTruth(p, sourceQuality);
}
