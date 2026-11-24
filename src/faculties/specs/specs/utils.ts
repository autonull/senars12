/**
 * Faculty Spec Utilities — shared utilities for faculty specifications.
 */

import type { FacultySpec, FacultyFallback } from '../../specs';

/** Create a fallback function for a faculty. */
export const createFallback = (
  faculty: string,
  result: unknown,
  confidence: number,
  description: string,
  strength: number
): FacultyFallback =>
  async () => ({
    faculty: faculty as any,
    result,
    confidence,
    evidence: [{ source: 'fallback', description, strength }],
    fallbackUsed: true,
    durationMs: 0,
  });