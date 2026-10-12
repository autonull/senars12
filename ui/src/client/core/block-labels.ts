/**
 * The one human label for a block. The kind's fallback label lives on its
 * descriptor (`block-descriptors.ts`); this picks the block's own text first so
 * the notebook, ToC, inspector and gallery agree without each spelling a table.
 */

import { blockDescriptor } from './block-descriptors.js';
import type { SemanticBlock } from './workspace-graph.js';

/** The one human label for a block: heading text > title > first non-blank line > kind. */
export function blockLabel(block: SemanticBlock): string {
  const kindLabel = blockDescriptor(block.kind).label;
  if (block.kind === 'heading') return block.text ?? block.title ?? kindLabel;
  const firstLine = block.text?.split('\n').find((line) => line.trim() !== '');
  return block.title ?? firstLine ?? kindLabel;
}
