/**
 * Aspect registry — open aspect projections (§5, §12).
 *
 * Every aspect is a registered projector (`{ id, project(resolution, ctx) }`).
 * The core aspects (neighborhood, content, provenance, origin, history, ambient, direct)
 * are registered by default; extensions add their own.
 */

import type { FocusResolution } from './resolver.js';
import type { WorkspaceGraph } from '../core/workspace-graph.js';
import { createRegistry } from '../core/registry-factory.js';

/** Context passed to aspect projectors. */
export interface ProjectionContext {
  readonly substrate: WorkspaceGraph;
  readonly depth?: number;
  readonly time?: { readonly kind: string; readonly [key: string]: unknown };
  readonly fidelity?: string;
  readonly aspects?: readonly string[];
}

/** An aspect projector — computes a slice for a given focus. */
export interface AspectProjector<A = unknown> {
  readonly aspect: string;
  readonly label: string;
  readonly icon?: string;
  project(resolution: FocusResolution, ctx: ProjectionContext): A | undefined;
  /** Whether this aspect applies to a given focus kind. */
  appliesTo?(focusKind: string): boolean;
}

/** The core aspects SeNARS registers by default. */
export const CORE_ASPECTS: readonly AspectProjector[] = [
  {
    aspect: 'neighborhood',
    label: 'Neighborhood',
    icon: 'gitBranch',
    project: (resolution) => resolution.neighborhood,
    appliesTo: () => true,
  },
  {
    aspect: 'content',
    label: 'Content',
    icon: 'fileText',
    project: (resolution) => resolution.content,
    appliesTo: () => true,
  },
  {
    aspect: 'provenance',
    label: 'Provenance',
    icon: 'gitFork',
    project: (resolution) => resolution.provenance,
    appliesTo: () => true,
  },
  {
    aspect: 'origin',
    label: 'Origin',
    icon: 'source',
    project: () => undefined, // requires Judgment Manifold — gap declared
    appliesTo: () => true,
  },
  {
    aspect: 'history',
    label: 'History',
    icon: 'history',
    project: (resolution) => resolution.history,
    appliesTo: () => true,
  },
  {
    aspect: 'ambient',
    label: 'Ambient',
    icon: 'radio',
    project: () => undefined, // rendered from attention field
    appliesTo: () => true,
  },
  {
    aspect: 'direct',
    label: 'Direct',
    icon: 'settings',
    project: () => undefined, // settings/controls
    appliesTo: () => true,
  },
] as const;

// Create the registry using the generic factory
// Key is `aspect` not `id`, so we provide a custom keyOf
const aspectRegistry = createRegistry<AspectProjector>({
  registryName: 'Aspect',
  coreEntries: CORE_ASPECTS,
  keyOf: (p) => p.aspect,
});

// Add extra queries after creation to avoid circular references
const aspectsForFocus = (focusKind: string): readonly AspectProjector[] =>
  aspectRegistry.getAll().filter((a) => a.appliesTo?.(focusKind) ?? true);

// Re-export the standard registry API
export const {
  register: registerAspectProjection,
  get: getAspectProjection,
  getAll: getAspectProjections,
  has: hasAspectProjection,
  ids: aspectProjectionIds,
  reset: resetAspectProjections,
} = aspectRegistry;

// Re-export extra queries
export { aspectsForFocus };

/** Register the core SeNARS aspects. */
export const registerCoreAspects = (): void => {
  for (const projector of CORE_ASPECTS) registerAspectProjection(projector);
};

/** Type of registered aspect IDs (for exhaustiveness). */
export type RegisteredAspect = AspectProjector['aspect'];