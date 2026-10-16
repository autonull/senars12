/**
 * SemanticLinkKind purpose table — the one declared table for what each link kind means
 * (UI.17 §19.4, improvement opportunity). Replaces ad-hoc sets in the resolver.
 *
 * Each kind declares its semantic role(s). A kind may serve multiple purposes
 * (e.g., 'derived-from' is both provenance and trace). The resolver consumes this
 * table rather than hard-coding sets, so future instrumentation (breakpoints,
 * Instrument aspects) agrees on which link kinds mean "support", "revised", "caused".
 */

import type { SemanticLinkKind } from '../core/workspace-graph.js';

/** Re-export for consumers. */
export type { SemanticLinkKind };

/** The semantic purpose(s) a link kind serves. */
export type LinkPurpose =
  | 'provenance'   // how the focus came to be — derivation/evidence
  | 'history'      // the focus over time — revisions/predecessors
  | 'trace'        // the process instance — gate decisions, tool calls
  | 'containment'  // parent/child containment (children in content slice)
  | 'neighborhood' // graph neighbors (references, supports, etc.)
  | 'thread';      // conversational threading (responds-to, answers, etc.)

/** The declared table: every SemanticLinkKind maps to its purpose(s). */
export const LINK_KIND_PURPOSES: Readonly<Record<SemanticLinkKind, readonly LinkPurpose[]>> = {
  // Containment / structure
  contains: ['containment', 'neighborhood'],
  next: ['thread', 'neighborhood'],

  // Conversation / threading
  'responds-to': ['thread', 'neighborhood'],
  answers: ['thread', 'neighborhood'],
  asks: ['thread', 'neighborhood'],
  formalizes: ['thread', 'provenance', 'trace'],

  // Graph relations
  references: ['neighborhood'],
  supports: ['provenance', 'neighborhood'],
  contradicts: ['neighborhood'],
  revises: ['history', 'neighborhood'],
  elaborates: ['history', 'neighborhood'],
  summarizes: ['provenance', 'neighborhood'],
  achieves: ['neighborhood', 'trace'],
  'same-topic': ['neighborhood'],

  // Tool / gate process
  'uses-tool': ['trace'],
  'produced-by-tool': ['trace', 'provenance'],
  'derived-from': ['provenance', 'trace', 'history'],
  'admitted-by-gate': ['trace'],
  'rejected-by-gate': ['trace'],

  // Citations
  cites: ['provenance', 'neighborhood'],

  // Focus
  focuses: ['neighborhood'],
};

/** Get the purposes for a link kind. */
export const purposesOf = (kind: SemanticLinkKind): readonly LinkPurpose[] =>
  LINK_KIND_PURPOSES[kind] ?? [];

/** Whether a link kind serves a given purpose. */
export const servesPurpose = (kind: SemanticLinkKind, purpose: LinkPurpose): boolean =>
  purposesOf(kind).includes(purpose);

/** All link kinds that serve a given purpose. */
export const kindsForPurpose = (purpose: LinkPurpose): readonly SemanticLinkKind[] => {
  const kinds: SemanticLinkKind[] = [];
  for (const [kind, purposes] of Object.entries(LINK_KIND_PURPOSES)) {
    if (purposes.includes(purpose)) kinds.push(kind as SemanticLinkKind);
  }
  return kinds;
};

/** The link kinds for provenance slice (how the focus came to be). */
export const PROVENANCE_LINK_KINDS = kindsForPurpose('provenance');

/** The link kinds for history slice (the focus over time). */
export const HISTORY_LINK_KINDS = kindsForPurpose('history');

/** The link kinds for trace slice (the process instance). */
export const TRACE_LINK_KINDS = kindsForPurpose('trace');

/** The link kinds for containment (children in content slice). */
export const CONTAINMENT_LINK_KINDS = kindsForPurpose('containment');

/** The link kinds for neighborhood (graph neighbors). */
export const NEIGHBORHOOD_LINK_KINDS = kindsForPurpose('neighborhood');

/** The link kinds for threading (conversation flow). */
export const THREAD_LINK_KINDS = kindsForPurpose('thread');