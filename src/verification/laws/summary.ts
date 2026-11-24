import type { LawResult } from './types';

/** Law summary for reporting. */
export function summarizeLawResults(results: LawResult[]): {
  total: number;
  passed: number;
  failed: number;
  criticalFailed: number;
  majorFailed: number;
  minorFailed: number;
} {
  return {
    total: results.length,
    passed: results.filter(r => r.holds).length,
    failed: results.filter(r => !r.holds).length,
    criticalFailed: results.filter(r => !r.holds && r.severity === 'critical').length,
    majorFailed: results.filter(r => !r.holds && r.severity === 'major').length,
    minorFailed: results.filter(r => !r.holds && r.severity === 'minor').length,
  };
}

/** Check if all critical laws pass. */
export function criticalLawsPass(results: LawResult[]): boolean {
  return results.filter(r => r.severity === 'critical').every(r => r.holds);
}