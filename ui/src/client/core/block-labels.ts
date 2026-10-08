/**
 * The one presentation label per `BlockKind` — exhaustive (`satisfies`), so a new
 * kind cannot land without naming itself. The notebook, ToC, inspector and
 * gallery all read this rather than each spelling their own label table.
 */

import type { BlockKind } from './workspace-graph.js';

export const BLOCK_KIND_LABEL = {
  turn: 'Turn',
  section: 'Section',
  heading: 'Heading',
  paragraph: 'Paragraph',
  claim: 'Claim',
  question: 'Question',
  answer: 'Answer',
  list: 'List',
  table: 'Table',
  code: 'Code',
  math: 'Math',
  image: 'Image',
  diagram: 'Diagram',
  chart: 'Chart',
  citation: 'Citation',
  'tool-call': 'Tool call',
  'tool-result': 'Tool result',
  derivation: 'Derivation',
  'gate-decision': 'Gate decision',
  budget: 'Budget',
  command: 'Command',
  'config-change': 'Config change',
  error: 'Error',
  'embedded-view': 'Embedded view',
  raw: 'Raw',
} satisfies Record<BlockKind, string>;
