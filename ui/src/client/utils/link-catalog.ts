/**
 * The one presentation registry for the semantic link vocabulary — every
 * `SemanticLinkKind` gets exactly one metadata row here, and the notebook and
 * graph renderers read it instead of hardcoding labels, categories, edge styles
 * or which layouts/lenses feature a relationship. Adding a kind is one catalog
 * row; exhaustiveness is a type (`satisfies Record<SemanticLinkKind, …>`), so a
 * new kind cannot land without its presentation, and a typo cannot land at all.
 */

import type { BuiltinLens } from '../../shared/lens-schema.js';
import type { SemanticLinkKind } from '../core/workspace-graph.js';

/** Coarse grouping for filtering, narration tone and gallery/report sections. */
export type LinkCategory = 'structure' | 'discourse' | 'evidence' | 'action' | 'provenance';

/** How an edge is drawn by the graph renderer. */
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';

/** How the notebook renders the relationship beside a block. */
export type NotebookLinkStyle = 'inline' | 'chip' | 'trace' | 'reference';

export type LinkMeta = {
  readonly label: string;
  readonly category: LinkCategory;
  readonly edgeStyle: EdgeStyle;
  readonly notebookStyle: NotebookLinkStyle;
  /** `layoutRegistry` ids that feature this relationship (Phase 2/3 layouts). */
  readonly layouts: readonly string[];
  /** Built-in lenses that feature this relationship. */
  readonly lenses: readonly BuiltinLens[];
};

export const LINK_CATALOG = {
  contains: { label: 'contains', category: 'structure', edgeStyle: 'solid', notebookStyle: 'inline', layouts: ['artifact-map', 'semantic-map'], lenses: ['belief'] },
  next: { label: 'next', category: 'structure', edgeStyle: 'dotted', notebookStyle: 'inline', layouts: ['chronological-flow'], lenses: ['temporal'] },
  'responds-to': { label: 'responds to', category: 'discourse', edgeStyle: 'solid', notebookStyle: 'reference', layouts: ['chronological-flow', 'source-view'], lenses: ['belief'] },
  answers: { label: 'answers', category: 'discourse', edgeStyle: 'solid', notebookStyle: 'chip', layouts: ['semantic-map', 'source-view'], lenses: ['belief', 'goal'] },
  asks: { label: 'asks', category: 'discourse', edgeStyle: 'dashed', notebookStyle: 'chip', layouts: ['semantic-map', 'source-view'], lenses: ['goal'] },
  references: { label: 'references', category: 'discourse', edgeStyle: 'dashed', notebookStyle: 'reference', layouts: ['semantic-map', 'artifact-map'], lenses: ['belief', 'temporal'] },
  supports: { label: 'supports', category: 'evidence', edgeStyle: 'solid', notebookStyle: 'trace', layouts: ['reasoning-provenance', 'contradiction-neighborhood'], lenses: ['belief'] },
  contradicts: { label: 'contradicts', category: 'evidence', edgeStyle: 'dashed', notebookStyle: 'trace', layouts: ['contradiction-neighborhood'], lenses: ['contradiction'] },
  revises: { label: 'revises', category: 'evidence', edgeStyle: 'dashed', notebookStyle: 'trace', layouts: ['contradiction-neighborhood'], lenses: ['contradiction', 'temporal'] },
  elaborates: { label: 'elaborates', category: 'discourse', edgeStyle: 'solid', notebookStyle: 'inline', layouts: ['semantic-map'], lenses: ['belief'] },
  summarizes: { label: 'summarizes', category: 'discourse', edgeStyle: 'dotted', notebookStyle: 'chip', layouts: ['semantic-map'], lenses: ['belief'] },
  achieves: { label: 'achieves', category: 'action', edgeStyle: 'solid', notebookStyle: 'chip', layouts: ['semantic-map'], lenses: ['goal'] },
  'uses-tool': { label: 'uses tool', category: 'action', edgeStyle: 'solid', notebookStyle: 'chip', layouts: ['chronological-flow', 'artifact-map'], lenses: ['belief'] },
  'produced-by-tool': { label: 'produced by tool', category: 'action', edgeStyle: 'solid', notebookStyle: 'reference', layouts: ['artifact-map'], lenses: ['belief'] },
  'derived-from': { label: 'derived from', category: 'provenance', edgeStyle: 'solid', notebookStyle: 'trace', layouts: ['reasoning-provenance'], lenses: ['belief'] },
  'admitted-by-gate': { label: 'admitted', category: 'provenance', edgeStyle: 'solid', notebookStyle: 'trace', layouts: ['gate-pipeline'], lenses: ['belief'] },
  'rejected-by-gate': { label: 'rejected', category: 'provenance', edgeStyle: 'dashed', notebookStyle: 'trace', layouts: ['gate-pipeline', 'contradiction-neighborhood'], lenses: ['belief'] },
  formalizes: { label: 'formalizes', category: 'discourse', edgeStyle: 'dashed', notebookStyle: 'chip', layouts: ['gate-pipeline'], lenses: ['belief'] },
  cites: { label: 'cites', category: 'discourse', edgeStyle: 'dotted', notebookStyle: 'reference', layouts: ['artifact-map'], lenses: ['belief'] },
  focuses: { label: 'focuses', category: 'discourse', edgeStyle: 'dotted', notebookStyle: 'chip', layouts: ['semantic-map'], lenses: ['belief', 'goal'] },
  'same-topic': { label: 'same topic', category: 'discourse', edgeStyle: 'dotted', notebookStyle: 'chip', layouts: ['semantic-map'], lenses: ['belief'] },
} satisfies Record<SemanticLinkKind, LinkMeta>;

export type LinkKind = keyof typeof LINK_CATALOG;

export const LINK_KINDS = Object.keys(LINK_CATALOG) as SemanticLinkKind[];

export const LINK_CATEGORIES = [
  'structure',
  'discourse',
  'evidence',
  'action',
  'provenance',
] as const satisfies readonly LinkCategory[];

export const linkMeta = (kind: SemanticLinkKind): LinkMeta => LINK_CATALOG[kind];

export const linksByCategory = (category: LinkCategory): SemanticLinkKind[] =>
  LINK_KINDS.filter((kind) => LINK_CATALOG[kind].category === category);

export const linksByLayout = (layout: string): SemanticLinkKind[] =>
  LINK_KINDS.filter((kind) => (LINK_CATALOG[kind] as LinkMeta).layouts.includes(layout));

export const linksByLens = (lens: BuiltinLens): SemanticLinkKind[] =>
  LINK_KINDS.filter((kind) => (LINK_CATALOG[kind] as LinkMeta).lenses.includes(lens));
