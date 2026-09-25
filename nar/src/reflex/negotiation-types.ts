/**
 * Phase E (REFACTOR.todo2 §3): shared negotiation types — a dependency leaf
 * (no imports) so arbitration strategies, proposers, and the Negotiator can
 * interoperate without joining the Focus/Game import cycle.
 */

export interface NALDerivation {
  action: string;
  truth: { f: number; c: number };
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
