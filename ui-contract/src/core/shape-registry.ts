/**
 * Shape registry — open view shapes (§6, §12).
 *
 * Every shape is a registered spec with its rendering capabilities.
 * The core shapes SeNARS registers by default are the 7 from view-spec.ts;
 * extensions add their own. This replaces the closed `Shape` union.
 */

import type { Budget, Interaction } from './view-spec.js';
import { createRegistry } from './registry-factory.js';

/** A shape specification — what a shape can render and how. */
export interface ShapeSpec {
  readonly id: string;
  readonly label: string;
  readonly budgets: readonly Budget[];
  readonly interactions: readonly Interaction[];
  readonly tag: string; // custom element tag that renders this shape
  /** Optional: fidelity range this shape supports (e.g., 'glyph' to 'full'). */
  readonly fidelityRange?: readonly string[];
}

/** The core shape specifications SeNARS registers by default. */
export const CORE_SHAPES: readonly ShapeSpec[] = [
  {
    id: 'graph',
    label: 'Graph',
    budgets: ['full', 'embedded'],
    interactions: ['select', 'multi-select', 'zoom', 'link', 'highlight', 'filter'],
    tag: 'graph-viewport',
    fidelityRange: ['glyph', 'label', 'card', 'full'],
  },
  {
    id: 'series',
    label: 'Series',
    budgets: ['full'],
    interactions: ['select', 'highlight'],
    tag: 's-series',
    fidelityRange: ['label', 'card', 'detail', 'full'],
  },
  {
    id: 'table',
    label: 'Table',
    budgets: ['full'],
    interactions: ['select', 'multi-select', 'filter', 'highlight'],
    tag: 's-table',
    fidelityRange: ['card', 'detail', 'full'],
  },
  {
    id: 'tree',
    label: 'Tree',
    budgets: ['full', 'embedded'],
    interactions: ['select', 'link'],
    tag: 's-tree',
    fidelityRange: ['glyph', 'label', 'card', 'full'],
  },
  {
    id: 'text',
    label: 'Text',
    budgets: ['full', 'embedded'],
    interactions: ['select', 'filter'],
    tag: 's-text',
    fidelityRange: ['label', 'card', 'detail', 'full'],
  },
  {
    id: 'code',
    label: 'Code',
    budgets: ['full', 'embedded'],
    interactions: ['select'],
    tag: 's-code',
    fidelityRange: ['label', 'card', 'detail', 'full'],
  },
  {
    id: 'diff',
    label: 'Diff',
    budgets: ['full', 'embedded'],
    interactions: ['select'],
    tag: 's-diff',
    fidelityRange: ['label', 'card', 'detail', 'full'],
  },
] as const;

// Create the registry using the generic factory
const shapeRegistry = createRegistry<ShapeSpec>({
  registryName: 'Shape',
  coreEntries: CORE_SHAPES,
  keyOf: (s) => s.id,
});

// Add extra queries after creation to avoid circular references
const shapesForBudget = (budget: Budget): readonly ShapeSpec[] =>
  shapeRegistry.getAll().filter((s) => s.budgets.includes(budget));

const shapesForInteraction = (interaction: Interaction): readonly ShapeSpec[] =>
  shapeRegistry.getAll().filter((s) => s.interactions.includes(interaction));

const shapeTag = (id: string): string | undefined => shapeRegistry.get(id)?.tag;

const shapeFidelityRange = (id: string): readonly string[] | undefined => shapeRegistry.get(id)?.fidelityRange;

// Re-export the standard registry API
export const {
  register: registerShape,
  get: getShape,
  getAll: getShapes,
  has: hasShape,
  ids: shapeIds,
  reset: resetShapes,
} = shapeRegistry;

// Re-export extra queries
export { shapesForBudget, shapesForInteraction, shapeTag, shapeFidelityRange };

/** Register the core SeNARS shapes. */
export const registerCoreShapes = (): void => {
  for (const spec of CORE_SHAPES) registerShape(spec);
};

/** Type of registered shape IDs (for exhaustiveness). */
export type RegisteredShape = ShapeSpec['id'];