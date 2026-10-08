import type { Budget, Interaction, Shape, ShapeCaps } from './view-spec.js';

/**
 * The view-adapter registry. An adapter owns exactly one shape and names the
 * custom element that renders it, so the host resolves a tag from the shape
 * rather than switching on it — the registry, not a hand-written map, decides
 * what can render what, and which shapes exist at all.
 */
export interface ViewAdapter {
  readonly shape: Shape;
  /** Custom element the host mounts for this shape. */
  readonly tag: string;
  readonly budgets: readonly Budget[];
  readonly interactions: readonly Interaction[];
}

const registry = new Map<Shape, ViewAdapter>();

export const registerViewAdapter = (adapter: ViewAdapter): void => {
  registry.set(adapter.shape, adapter);
};

/** Every registered adapter, in registration order. */
export const viewAdapters = (): ViewAdapter[] => [...registry.values()];

/** The adapter for a shape that supports the requested budget, if any. */
export const viewAdapterFor = (shape: Shape, budget: Budget = 'full'): ViewAdapter | undefined => {
  const adapter = registry.get(shape);
  return adapter?.budgets.includes(budget) ? adapter : undefined;
};

export const capabilitiesFor = (shape: Shape): ShapeCaps | undefined => {
  const adapter = registry.get(shape);
  return adapter && { shape, budgets: adapter.budgets, interactions: adapter.interactions };
};

/** Shapes a budget can render — the shape switcher offers exactly these. */
export const supportedShapes = (budget: Budget = 'full'): Shape[] =>
  viewAdapters()
    .filter((adapter) => adapter.budgets.includes(budget))
    .map((adapter) => adapter.shape);