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

const registry = new Map<Shape, ViewAdapter[]>();

export const registerViewAdapter = (adapter: ViewAdapter): void => {
  registry.set(adapter.shape, [...(registry.get(adapter.shape) ?? []), adapter]);
};

/** Every registered adapter, in registration order. */
export const viewAdapters = (): ViewAdapter[] => [...registry.values()].flat();

/** Every adapter registered for a shape — the full variant and its compact ones. */
export const adaptersFor = (shape: Shape): ViewAdapter[] => registry.get(shape) ?? [];

/**
 * The adapter for a shape that supports the requested budget. When several do,
 * the most specialized wins — an `embedded`-only compact variant over one that
 * serves both budgets — so a compact adapter is selected by capability rather
 * than registration order. The full variant remains the fallback.
 */
export const viewAdapterFor = (shape: Shape, budget: Budget = 'full'): ViewAdapter | undefined =>
  adaptersFor(shape)
    .filter((adapter) => adapter.budgets.includes(budget))
    .sort((a, b) => a.budgets.length - b.budgets.length)[0];

/** What a shape can do, unioned across its variants. */
export const capabilitiesFor = (shape: Shape): ShapeCaps | undefined => {
  const adapters = adaptersFor(shape);
  if (adapters.length === 0) return undefined;
  return {
    shape,
    budgets: [...new Set(adapters.flatMap((adapter) => adapter.budgets))],
    interactions: [...new Set(adapters.flatMap((adapter) => adapter.interactions))],
  };
};

/** Shapes a budget can render — the shape switcher offers exactly these. */
export const supportedShapes = (budget: Budget = 'full'): Shape[] => [
  ...new Set(
    viewAdapters()
      .filter((adapter) => adapter.budgets.includes(budget))
      .map((adapter) => adapter.shape)
  ),
];