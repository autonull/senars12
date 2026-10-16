/**
 * Shape registry — open view shapes (§6, §12).
 *
 * Every shape is a registered spec with its rendering capabilities.
 * The core shapes SeNARS registers by default are the 7 from view-spec.ts;
 * extensions add their own. This replaces the closed `Shape` union.
 */

import type { Budget, Interaction } from './view-spec.js';

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

const shapeRegistry = new Map<string, ShapeSpec>();
const registrationOrder: string[] = [];

/** Register a shape specification. */
export const registerShape = (spec: ShapeSpec): void => {
  if (shapeRegistry.has(spec.id)) {
    console.warn(`Shape ${spec.id} already registered; overwriting`);
  } else {
    registrationOrder.push(spec.id);
  }
  shapeRegistry.set(spec.id, spec);
};

/** Get a registered shape specification. */
export const getShape = (id: string): ShapeSpec | undefined => shapeRegistry.get(id);

/** All registered shape specifications in registration order. */
export const getShapes = (): readonly ShapeSpec[] => registrationOrder.map((id) => shapeRegistry.get(id)!);

/** Whether a shape is registered. */
export const hasShape = (id: string): boolean => shapeRegistry.has(id);

/** Shape IDs in registration order. */
export const shapeIds = (): readonly string[] => [...registrationOrder];

/** Clear the registry (test-only). */
export const resetShapes = (): void => {
  shapeRegistry.clear();
  registrationOrder.length = 0;
};

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

/** Register the core SeNARS shapes. */
export const registerCoreShapes = (): void => {
  for (const spec of CORE_SHAPES) registerShape(spec);
};

/** Type of registered shape IDs (for exhaustiveness). */
export type RegisteredShape = ShapeSpec['id'];

/** Get shapes that support a given budget. */
export const shapesForBudget = (budget: Budget): readonly ShapeSpec[] =>
  getShapes().filter((s) => s.budgets.includes(budget));

/** Get shapes that support a given interaction. */
export const shapesForInteraction = (interaction: Interaction): readonly ShapeSpec[] =>
  getShapes().filter((s) => s.interactions.includes(interaction));

/** Get the custom element tag for a shape. */
export const shapeTag = (id: string): string | undefined => getShape(id)?.tag;

/** Get the fidelity range for a shape. */
export const shapeFidelityRange = (id: string): readonly string[] | undefined => getShape(id)?.fidelityRange;