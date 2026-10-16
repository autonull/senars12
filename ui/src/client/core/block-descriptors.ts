/**
 * The one descriptor per `BlockKind` (§D1): every facet a kind carries — its
 * label, whether it is an artifact / navigable / graph-renderable / a JSON
 * panel / a container / a section — lives on one record, so a kind cannot drift
 * across the six partial maps and three if-chains that used to spell it. The
 * catalog is the source of the `BlockKind` union too (Track F2): `keyof typeof
 * BLOCK_DESCRIPTORS`, so adding a kind is one entry and no hand union to edit.
 */

import { defineCatalog } from '../framework/catalog.js';

export const BLOCK_DESCRIPTORS = defineCatalog({
  turn: {
    label: 'Turn',
    artifact: false,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: true,
    section: true,
  },
  section: {
    label: 'Section',
    artifact: false,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: true,
    section: true,
  },
  heading: {
    label: 'Heading',
    artifact: false,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: true,
    section: false,
  },
  paragraph: {
    label: 'Paragraph',
    artifact: false,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  claim: {
    label: 'Claim',
    artifact: false,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  goal: {
    label: 'Goal',
    artifact: false,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  question: {
    label: 'Question',
    artifact: false,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  answer: {
    label: 'Answer',
    artifact: false,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  list: {
    label: 'List',
    artifact: false,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  table: {
    label: 'Table',
    artifact: true,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  code: {
    label: 'Code',
    artifact: true,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  math: {
    label: 'Math',
    artifact: true,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  image: {
    label: 'Image',
    artifact: true,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  diagram: {
    label: 'Diagram',
    artifact: true,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  chart: {
    label: 'Chart',
    artifact: true,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  citation: {
    label: 'Citation',
    artifact: true,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  'tool-call': {
    label: 'Tool call',
    artifact: false,
    navigable: true,
    jsonPanel: true,
    graphRenderable: true,
    container: false,
    section: false,
  },
  'tool-result': {
    label: 'Tool result',
    artifact: true,
    navigable: true,
    jsonPanel: true,
    graphRenderable: true,
    container: false,
    section: false,
  },
  derivation: {
    label: 'Derivation',
    artifact: true,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  'derivation-record': {
    label: 'Derivation record',
    artifact: false,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  'gate-decision': {
    label: 'Gate decision',
    artifact: false,
    navigable: true,
    jsonPanel: true,
    graphRenderable: true,
    container: false,
    section: false,
  },
  budget: {
    label: 'Budget',
    artifact: false,
    navigable: true,
    jsonPanel: true,
    graphRenderable: true,
    container: false,
    section: false,
  },
  command: {
    label: 'Command',
    artifact: false,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  'config-change': {
    label: 'Config change',
    artifact: false,
    navigable: false,
    jsonPanel: true,
    graphRenderable: true,
    container: false,
    section: false,
  },
  error: {
    label: 'Error',
    artifact: false,
    navigable: true,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
  raw: {
    label: 'Raw',
    artifact: false,
    navigable: false,
    jsonPanel: false,
    graphRenderable: true,
    container: false,
    section: false,
  },
} as const);

/** The semantic kind of a content block — the catalog keys are its source. */
export type BlockKind = keyof typeof BLOCK_DESCRIPTORS.definition;

/** Every block kind, in catalog order. */
export const BLOCK_KINDS = BLOCK_DESCRIPTORS.ids;

export type BlockEntry = typeof BLOCK_DESCRIPTORS.definition[BlockKind];

export const blockDescriptor = (kind: BlockKind): BlockEntry => BLOCK_DESCRIPTORS.get(kind);

/** The kinds a facet selects, in catalog order — the one way a partial map is read. */
export const kindsWhere = (facet: (descriptor: BlockEntry) => boolean): BlockKind[] =>
  BLOCK_DESCRIPTORS.where(facet);

/** All block kinds that are graph-renderable. */
export const graphRenderableKinds = (): BlockKind[] =>
  kindsWhere((d) => d.graphRenderable);