/**
 * Contribution — the unit of framework extension.
 *
 * A contribution declares:
 *   - `id`: stable, unique key (used as the union discriminant)
 *   - `label`: human-readable name
 *   - arbitrary facets: domain-specific payload the consumer interprets
 *
 * The framework only guarantees:
 *   - `id` is unique in the registry
 *   - `label` exists for palette/toolbar use
 *   - contributions are immutable after registration
 *
 * Consumers (palettes, toolbars, registries) read contributions through
 * the generic `Catalog<T>` API: `get(id)`, `ids()`, `where(predicate)`.
 */

export interface Contribution<F extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable, unique key — the registry's primary key. */
  readonly id: string;
  /** Human-readable label for palette/toolbar. */
  readonly label: string;
  /** Domain-specific facets (capabilities, layout, colors, etc.). */
  readonly facets: F;
}

/**
 * Register a contribution. Returns `true` if new, `false` if it replaced an
 * existing entry (only in tests — production code should not re-register).
 */
export function registerContribution<F extends Record<string, unknown>>(
  registry: Map<string, Contribution<F>>,
  contribution: Contribution<F>
): boolean {
  const isNew = !registry.has(contribution.id);
  registry.set(contribution.id, contribution);
  return isNew;
}

/**
 * Unregister a contribution (test-only).
 */
export function unregisterContribution<F extends Record<string, unknown>>(
  registry: Map<string, Contribution<F>>,
  id: string
): boolean {
  return registry.delete(id);
}

/**
 * Create a contribution from an id, label, and facets.
 */
export function createContribution<F extends Record<string, unknown>>(
  id: string,
  label: string,
  facets: F
): Contribution<F> {
  return { id, label, facets };
}