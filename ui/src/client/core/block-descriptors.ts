/**
 * The one descriptor per `BlockKind` (§D1): every facet a kind carries — its
 * label, whether it is an artifact / navigable / graph-renderable / a JSON
 * panel / a container / a section — lives on one record, so a kind cannot drift
 * across the six partial maps and three if-chains that used to spell it. The
 * catalog is the source of the `BlockKind` union too (Track F2): `keyof typeof
 * BLOCK_DESCRIPTORS`, so adding a kind is one entry and no hand union to edit.
 *
 * `d()` defaults every facet to `false`, so a new kind names only what it is;
 * an unknown facet key is an excess-property error against `BlockDescriptor`.
 */

export interface BlockDescriptor {
  /** Human label for palettes, ToC rows and graph nodes. */
  readonly label: string;
  /** Carries a structured artifact payload worth a `ViewSpec` (`ARTIFACT_KINDS`). */
  readonly artifact: boolean;
  /** Worth a navigable ToC row (`TOC_KINDS`). */
  readonly navigable: boolean;
  /** Inspected as structured JSON when it has no bespoke view (`JSON_KINDS`). */
  readonly jsonPanel: boolean;
  /** Presented richly by the graph renderer (`GRAPH_BLOCK_KINDS`). */
  readonly graphRenderable: boolean;
  /** May parent contained children when it has them (`isContainer`). */
  readonly container: boolean;
  /** A page/section in the reading model (`isSection`). */
  readonly section: boolean;
}

const d = (
  label: string,
  facets: Partial<Omit<BlockDescriptor, 'label'>> = {}
): BlockDescriptor => ({
  label,
  artifact: false,
  navigable: false,
  jsonPanel: false,
  graphRenderable: false,
  container: false,
  section: false,
  ...facets,
});

export const BLOCK_DESCRIPTORS = {
  turn: d('Turn', { container: true, section: true, graphRenderable: true }),
  section: d('Section', { container: true, section: true, graphRenderable: true }),
  heading: d('Heading', { container: true, navigable: true, graphRenderable: true }),
  paragraph: d('Paragraph', { graphRenderable: true }),
  claim: d('Claim', { navigable: true, graphRenderable: true }),
  question: d('Question', { navigable: true, graphRenderable: true }),
  answer: d('Answer', { navigable: true, graphRenderable: true }),
  list: d('List', { graphRenderable: true }),
  table: d('Table', { artifact: true, navigable: true, graphRenderable: true }),
  code: d('Code', { artifact: true, navigable: true, graphRenderable: true }),
  math: d('Math', { artifact: true, graphRenderable: true }),
  image: d('Image', { artifact: true, graphRenderable: true }),
  diagram: d('Diagram', { artifact: true, graphRenderable: true }),
  chart: d('Chart', { artifact: true, graphRenderable: true }),
  citation: d('Citation', { artifact: true, graphRenderable: true }),
  'tool-call': d('Tool call', { navigable: true, jsonPanel: true, graphRenderable: true }),
  'tool-result': d('Tool result', { artifact: true, navigable: true, jsonPanel: true, graphRenderable: true }),
  derivation: d('Derivation', { artifact: true, navigable: true, graphRenderable: true }),
  'derivation-record': d('Derivation record', { graphRenderable: true }),
  'gate-decision': d('Gate decision', { navigable: true, jsonPanel: true, graphRenderable: true }),
  budget: d('Budget', { navigable: true, jsonPanel: true, graphRenderable: true }),
  command: d('Command', { graphRenderable: true }),
  'config-change': d('Config change', { jsonPanel: true, graphRenderable: true }),
  error: d('Error', { navigable: true, graphRenderable: true }),
  raw: d('Raw', { graphRenderable: true }),
} satisfies Record<string, BlockDescriptor>;

/** The semantic kind of a content block — the catalog keys are its source. */
export type BlockKind = keyof typeof BLOCK_DESCRIPTORS;

/** Every block kind, in catalog order. */
export const BLOCK_KINDS = Object.keys(BLOCK_DESCRIPTORS) as readonly BlockKind[];

export const blockDescriptor = (kind: BlockKind): BlockDescriptor => BLOCK_DESCRIPTORS[kind];

/** The kinds a facet selects, in catalog order — the one way a partial map is read. */
export const kindsWhere = (facet: (descriptor: BlockDescriptor) => boolean): BlockKind[] =>
  BLOCK_KINDS.filter((kind) => facet(BLOCK_DESCRIPTORS[kind]));
