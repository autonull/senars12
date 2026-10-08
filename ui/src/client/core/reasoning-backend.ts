/**
 * The `ReasoningBackend` contract (§0.6, §3.2). One engine-agnostic seam over
 * whatever holds the reasoning substrate: the NARS engine behind
 * `cognitive.delta` is adapter #1, MeTTa the second (WP5 `3.7`). An adapter
 * declares the vocabulary it speaks and hands back the substrate it currently
 * holds, so the projection — and every renderer, ToC and popover downstream of
 * it — is written once and never switches on the engine.
 *
 * Deliberately absent: what a backend can *do* (`submit`/`step`/`run`) and its
 * capability flags. Those are claims about producers the wire does not carry
 * yet (WP5 `3.6`), and a contract promising affordances nobody can honour is
 * the dead API this plan keeps refusing.
 */

import type { BlockKind, Ref, SemanticLinkKind, Uncertainty } from './workspace-graph.js';

/** The kinds an engine speaks, mapped onto the kinds the substrate speaks. */
export interface BackendVocabulary {
  readonly nodes: Readonly<Record<string, BlockKind>>;
  readonly edges: Readonly<Record<string, SemanticLinkKind>>;
}

/** One substrate node; `attrs` is the engine record, kept verbatim. */
export interface BackendNode {
  readonly id: Ref;
  /** The engine's own node kind — resolved through `BackendVocabulary.nodes`. */
  readonly kind: string;
  readonly label: string;
  /** The node's textual content, when it has one. */
  readonly text?: string;
  readonly attrs: Record<string, unknown>;
  /** Truth as the engine declares it, labelled with the backend's `kind`. */
  readonly uncertainty?: Uncertainty;
}

/** One substrate edge; resolved through `BackendVocabulary.edges`. */
export interface BackendEdge {
  readonly id: Ref;
  readonly source: Ref;
  readonly target: Ref;
  /** The engine's own edge kind. */
  readonly kind: string;
  readonly confidence?: number;
}

/** The substrate as it stands, as one coherent read. */
export interface BackendSnapshot {
  readonly nodes: ReadonlyMap<Ref, BackendNode>;
  readonly edges: ReadonlyMap<Ref, BackendEdge>;
}

export interface ReasoningBackend {
  readonly id: string;
  /**
   * The engine's own vocabulary (`'nal'`, `'probability'`, `'proof-checked'`).
   * Uncertainty rendering is data, not a hard-coded NAL assumption, so the label
   * travels with the adapter rather than with the projection.
   */
  readonly kind: string;
  readonly vocab: BackendVocabulary;
  snapshot(): BackendSnapshot;
}
