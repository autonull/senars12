/**
 * D11 (TODO17b): bounded event logs for kernel gates — drop-oldest rings.
 * Everything that grows has a bound; kernel logs cap at 1000 events.
 */

import type { PolicyViolationEvent } from '@senars/core/schemas';
import { BoundedRing } from '@senars/util';

export const GATE_LOG_CAPACITY = 1000;

export interface PolicyViolationInput {
  readonly policyId: string;
  readonly violationType: PolicyViolationEvent['payload']['violationType'];
  readonly detail: string;
  readonly correlationId: string;
  readonly severity?: PolicyViolationEvent['payload']['severity'];
}

/** Bounded append-only gate log: the shared drop-oldest ring at kernel capacity. */
export const gateLog = <T>(): BoundedRing<T> => new BoundedRing<T>(GATE_LOG_CAPACITY);
