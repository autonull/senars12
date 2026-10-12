/**
 * The surface registry: the pure, DOM-free half of the surface contract. A
 * `SurfaceDescriptor` is data, so it can be enumerated by generators (stories,
 * gallery cells, a11y targets, docs) without importing a `LitElement`. The
 * component half (`surface.ts`) registers here when `defineSurface` runs.
 *
 * Re-exports from the unified framework surface (P2) while maintaining
 * backward compatibility with the existing descriptor shape.
 */

import {
  surfaceRegistry,
  registerSurface,
  surfaceFor,
  getSurfaces,
  surfacesWhere,
  surfaceIdsWhere,
  surfacesByPlacement,
  surfaceIdsByPlacement,
  surfaceTag,
  defaultPresentation,
  resolvedPresentation,
  type SurfaceDescriptor as FrameworkSurfaceDescriptor,
  type Placement,
  type Presentation,
  type SurfaceBinding,
  type SurfaceSource,
  type SurfaceA11y,
  type SurfaceBase,
} from '../framework/surface.js';

/** @deprecated Use the unified Placement from framework/surface.ts */
export type { Placement, Presentation, SurfaceBinding, SurfaceSource, SurfaceA11y, SurfaceBase };

/** Backward-compatible surface descriptor with placement + presentation. */
export interface SurfaceDescriptor extends FrameworkSurfaceDescriptor {}

/** The generic surface registry (unified). */
export { surfaceRegistry, registerSurface, surfaceFor };

/** Every registered surface, in registration order. */
export { getSurfaces };

/** Filter surfaces by a predicate on the descriptor. */
export { surfacesWhere, surfaceIdsWhere };

/** Get surfaces by placement. */
export { surfacesByPlacement, surfaceIdsByPlacement };

/** Compute the custom-element tag for a surface. */
export { surfaceTag };

/** Default presentation for a placement. */
export { defaultPresentation };

/** Merge a descriptor's presentation with placement defaults. */
export { resolvedPresentation };