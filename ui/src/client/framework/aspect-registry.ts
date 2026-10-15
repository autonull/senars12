/**
 * Aspect registry — open aspect projections (§5, §12).
 *
 * Every aspect is a registered projector (`{ id, project(resolution, ctx) }`).
 * The core aspects (neighborhood, content, provenance, origin, history, ambient, direct)
 * are registered by default; extensions add their own.
 */

import type { FocusRef, Aspect } from '../framework/coordinates.js';
import type { FocusResolution } from '../framework/resolver.js';
import type { WorkspaceGraph } from '../core/workspace-graph.js';

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

const aspectRegistry = new Map<string, AspectProjector>();
const registrationOrder: string[] = [];

/** Register an aspect projector. */
export const registerAspectProjection = (projector: AspectProjector): void => {
  if (aspectRegistry.has(projector.aspect)) {
    console.warn(`Aspect ${projector.aspect} already registered; overwriting`);
  } else {
    registrationOrder.push(projector.aspect);
  }
  aspectRegistry.set(projector.aspect, projector);
};

/** Get a registered aspect projector. */
export const getAspectProjection = (aspect: string): AspectProjector | undefined => aspectRegistry.get(aspect);

/** All registered aspect projectors in registration order. */
export const getAspectProjections = (): readonly AspectProjector[] => registrationOrder.map((id) => aspectRegistry.get(id)!);

/** Whether an aspect is registered. */
export const hasAspectProjection = (aspect: string): boolean => aspectRegistry.has(aspect);

/** Aspect IDs in registration order. */
export const aspectProjectionIds = (): readonly string[] => [...registrationOrder];

/** Clear the registry (test-only). */
export const resetAspectProjections = (): void => {
  aspectRegistry.clear();
  registrationOrder.length = 0;
};

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

/** Register the core SeNARS aspects. */
export const registerCoreAspects = (): void => {
  for (const projector of CORE_ASPECTS) registerAspectProjection(projector);
};

/** Type of registered aspect IDs (for exhaustiveness). */
export type RegisteredAspect = AspectProjector['aspect'];

/** Get aspects applicable to a focus kind. */
export const aspectsForFocus = (focusKind: string): readonly AspectProjector[] =>
  getAspectProjections().filter((a) => a.appliesTo?.(focusKind) ?? true);