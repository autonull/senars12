/**
 * Phase E (REFACTOR.todo2 §3): shared negotiation types — a dependency leaf (no
 * nar-internal imports) so arbitration strategies, proposers, and the Negotiator
 * can interoperate without joining the Focus/Game import cycle.
 */
import type { TermTruth } from '@senars/util';

export interface NALDerivation {
  action: string;
  truth: TermTruth;
  source: string;
  /** Serialized premise term the derivation was indexed from (belief seeding, E7). */
  premise?: string;
}

export interface NegotiationDecision {
  action: string | null;
  actionExecuted: string | null;
  vetoedBy: string | null;
  confidence: number;
  source: 'reflex' | 'nal' | 'none';
  /** Phase C (REFACTOR.todo3): which strategy produced this decision (telemetry). */
  arbitration: 'nal-veto' | 'weighted-quorum';
}
