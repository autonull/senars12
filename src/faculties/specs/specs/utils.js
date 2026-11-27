/**
 * Faculty Spec Utilities — shared utilities for faculty specifications.
 */
/** Create a fallback function for a faculty. */
export const createFallback = (faculty, result, confidence, description, strength) => async () => ({
    faculty: faculty,
    result,
    confidence,
    evidence: [{ source: 'fallback', description, strength }],
    fallbackUsed: true,
    durationMs: 0,
});
