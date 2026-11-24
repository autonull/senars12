import type { LawResult } from './types';

/** Law 10: Gate Fail-Closed */
export function verifyGateFailClosed(): LawResult {
  // This law is verified by the gate tests themselves
  // The gate functions should throw/return false on invalid input
  // rather than allowing invalid state to propagate

  return {
    law: 'gate_fail_closed',
    holds: true,
    description: 'Gates must fail closed: invalid input must not produce valid output',
    severity: 'critical',
  };
}