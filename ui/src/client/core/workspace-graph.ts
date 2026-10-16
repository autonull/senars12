/**
 * The WorkspaceGraph — the one semantic substrate every workspace renderer
 * projects. Conversation, artifacts, reasoning and actions are all blocks and
 * links over one id namespace, event-sourced from a monotonic op stream exactly
 * as SeNARS state is a projection of its event log. `focus`/`selection`/
 * `timeCursor` are session state that survives a renderer switch and are not
 * part of the op stream. The ViewSpec system sits one level down, inside
 * overlays and embedded views.
 */

import type { BlockKind } from './block-descriptors.js';
import type { PayloadOf } from './block-payload.js';
import type { ViewSpec } from './view-spec.js';

export type { BlockKind };

/** One id namespace: a block's `Ref` is a graph node id, a popover anchor, a citation target and an engine `Ref`. */
import {
  emptyWorkspaceGraph as contractEmptyWorkspaceGraph,
  applyWorkspaceOp as contractApplyWorkspaceOp,
  applyWorkspaceOps as contractApplyWorkspaceOps,
  linksTouching as contractLinksTouching,
} from '@senars/ui-contract/core';

export type Ref = import('@senars/ui-contract/core').Ref;

/** Engine-declared uncertainty; its rendering is data via the field catalog, not hard-coded. Refined over contract. */
export type Uncertainty = import('@senars/ui-contract/core').Uncertainty;

/** A self-describing payload an agent emits; known kinds render richly, unknown kinds degrade to text/JSON. Refined over contract's Artifact shape. */
export type Artifact<T = unknown> = import('@senars/ui-contract/core').Artifact<T> & { spec?: ViewSpec };

/** The semantic kind of a content block (§2.1). */

/** Who a block speaks as. Refined over contract. */
export type SemanticRole = import('@senars/ui-contract/core').SemanticRole;

/** The lifecycle of a block under streaming. Refined over contract. */
export type BlockStatus = import('@senars/ui-contract/core').BlockStatus;

/** The producer of a block or link. Refined over contract. */
export type CreatedBy = import('@senars/ui-contract/core').CreatedBy;

export interface SemanticBlock<K extends BlockKind = BlockKind> {
  id: Ref;
  kind: K;
  role: SemanticRole;
  title?: string;
  text?: string;
  /** Heading depth / grouping level. */
  level?: number;
  /** Structured payload, typed by `kind` for the kinds that declare one (`block-payload.ts`). */
  data?: PayloadOf<K>;
  /** Formalized artifact contract. */
  artifact?: Artifact;
  /** Rich render instruction for the inner view system (§3.3). */
  spec?: ViewSpec;
  children?: Ref[];
  /** Who/what produced it. */
  sourceRefs?: Ref[];
  /** Cognitive events behind it. */
  eventRefs?: Ref[];
  /** Derivations/records behind it. */
  provenanceRefs?: Ref[];
  /** Engine-declared uncertainty. */
  uncertainty?: Uncertainty;
  status?: BlockStatus;
  createdAt: number;
  createdBy: CreatedBy;
}

/** The semantic kind of a link (§2.2). */
export type SemanticLinkKind =
  | 'contains'
  | 'next'
  | 'responds-to'
  | 'answers'
  | 'asks'
  | 'references'
  | 'supports'
  | 'contradicts'
  | 'revises'
  | 'elaborates'
  | 'summarizes'
  | 'achieves'
  | 'uses-tool'
  | 'produced-by-tool'
  | 'derived-from'
  | 'admitted-by-gate'
  | 'rejected-by-gate'
  | 'formalizes'
  | 'cites'
  | 'focuses'
  | 'same-topic';

export interface SemanticLink {
  id: Ref;
  source: Ref;
  target: Ref;
  kind: SemanticLinkKind;
  label?: string;
  confidence?: number;
  uncertainty?: Uncertainty;
  eventRefs?: Ref[];
  createdBy: CreatedBy;
}

export interface WorkspaceGraph {
  blocks: Map<Ref, SemanticBlock>;
  links: Map<Ref, SemanticLink>;
  /** Notebook page order. */
  roots: Ref[];
  /** Client/session state — not event-sourced. */
  focus?: Ref;
  /** Client/session state — not event-sourced. */
  selection: Set<Ref>;
  /** Present-anchored scrub position — client/session state. */
  timeCursor?: number;
}

/** Event-sourced workspace mutation (§2.3); `seq` monotonicity comes from `UnifiedGraphProjection`. */
export type WorkspaceOp =
  | { op: 'block.add'; block: SemanticBlock; after?: Ref; seq?: number; eventRefs?: Ref[] }
  | { op: 'block.patch'; id: Ref; patch: Partial<SemanticBlock>; seq?: number; eventRefs?: Ref[] }
  | { op: 'block.remove'; id: Ref; seq?: number; eventRefs?: Ref[] }
  | { op: 'link.add'; link: SemanticLink; seq?: number; eventRefs?: Ref[] }
  | { op: 'link.remove'; id: Ref; seq?: number; eventRefs?: Ref[] }
  | { op: 'roots.set'; roots: Ref[]; seq?: number; eventRefs?: Ref[] };

/** Create an empty workspace graph (contract-level, refined to SeNARS types). */
export const emptyWorkspaceGraph = contractEmptyWorkspaceGraph as () => WorkspaceGraph;

/** Apply one op, returning a new graph (copy-on-write for the store atom). Contract-level; refined to SeNARS types. */
export const applyWorkspaceOp = contractApplyWorkspaceOp as (graph: WorkspaceGraph, op: WorkspaceOp) => WorkspaceGraph;

/** Fold an op stream onto a graph, in order. Contract-level; refined to SeNARS types. */
export const applyWorkspaceOps = contractApplyWorkspaceOps as (graph: WorkspaceGraph, ops: readonly WorkspaceOp[]) => WorkspaceGraph;

/** The links touching a block, in either direction. Contract-level; refined to SeNARS types. */
export const linksTouching = contractLinksTouching as (graph: WorkspaceGraph, id: Ref) => SemanticLink[];
