/**
 * The `ReasoningBackend` contract (§0.6, §3.2, §3.6). One engine-agnostic seam
 * over whatever holds the reasoning substrate: the NARS engine behind
 * `cognitive.delta` is adapter #1, MeTTa the second (WP5 `3.7`). An adapter
 * declares the vocabulary it speaks and hands back the substrate it currently
 * holds, so the projection — and every renderer, ToC and popover downstream of
 * it — is written once and never switches on the engine.
 *
 * The control half (`submit`/`step`/`run` + `BackendCaps`) is the steer/author
 * surface (§3.6). A backend that does not implement a control method simply
 * omits it from its `caps`; the UI gates affordances on `caps` rather than
 * assuming every engine can do everything.
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
  /** When the engine says this happened; absent when it has no timeline. */
  readonly occurredAt?: number;
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

/** What the backend can *do* — the UI gates steer/author affordances on this. */
export interface BackendCaps {
  readonly canSubmit: boolean;
  readonly canStep: boolean;
  readonly canRun: boolean;
  readonly canRetract: boolean;
  readonly canRevise: boolean;
  readonly canAddGoal: boolean;
  readonly canAdjustBudget: boolean;
  readonly canAdjustProvider: boolean;
}

/** Input to a `submit` call — a NAL sentence or a structured task. */
export interface SubmitInput {
  readonly term: string;
  readonly mode?: 'belief' | 'goal' | 'question';
}

/** Result of a control operation. */
export interface ControlResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly seqId?: number;
}

/**
 * A steer/author operation the backend can perform. The engine owns the
 * mutation; the UI calls through the backend and the resulting
 * `cognitive.delta` frames update the graph.
 */
export interface ReasoningControl {
  /** Submit a new sentence/task to the reasoner. */
  submit(input: SubmitInput): Promise<ControlResult>;
  /** Execute a single inference step. */
  step(): Promise<ControlResult>;
  /** Run the reasoner until the budget is exhausted or a result is produced. */
  run(): Promise<ControlResult>;
  /** Retract a belief by its node id. */
  retract(nodeId: Ref): Promise<ControlResult>;
  /** Revise the truth value of a belief. */
  revise(nodeId: Ref, frequency: number, confidence: number): Promise<ControlResult>;
  /** Add a goal node. */
  addGoal(term: string): Promise<ControlResult>;
  /** Adjust the reasoning budget. */
  adjustBudget(budget: number): Promise<ControlResult>;
  /** Switch the LM provider for reasoning. */
  adjustProvider(providerId: string): Promise<ControlResult>;
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
  readonly caps: BackendCaps;
  snapshot(): BackendSnapshot;
  /** Optional control surface — present when the engine exposes steer/author. */
  control?: ReasoningControl;
}
