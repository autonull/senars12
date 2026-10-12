/**
 * Renderer definitions — now a view onto the unified surface registry (P2).
 *
 * A renderer is a surface with `placement: 'viewport'`. This module provides
 * backward-compatible APIs while the unified registry is the single source.
 */

import type { Capability } from './capabilities.js';
import type { WorkspaceInteraction } from './workspace-renderer.js';
import type { Channel } from '../modulation/types.js';
import { defineCatalog } from '../framework/catalog.js';
import {
  surfaceRegistry,
  registerSurface,
  surfaceFor,
  getSurfaces,
  surfacesByPlacement,
  surfaceIdsByPlacement,
  type SurfaceDescriptor,
  type Placement,
  type Presentation,
} from '../framework/surface.js';

const channels = (...names: Channel[]): ReadonlySet<Channel> => new Set(names);

/** Renderer-specific presentation options (subset of unified Presentation). */
export interface RendererPresentation extends Presentation {
  readonly surface: string;
  readonly controls?: readonly string[];
  readonly interactions?: readonly string[];
  readonly parity?: 'full' | 'partial';
  readonly capabilities?: {
    readonly node: ReadonlySet<Channel>;
    readonly edge: ReadonlySet<Channel>;
  };
}

/** Backward-compatible renderer entry. */
export interface RendererEntry {
  readonly label: string;
  readonly icon: string;
  readonly capabilities: {
    readonly node: ReadonlySet<Channel>;
    readonly edge: ReadonlySet<Channel>;
  };
  readonly parity: 'full' | 'partial';
  readonly surface: string;
  readonly controls?: readonly string[];
  readonly interactions?: readonly string[];
}

/** Convert a legacy RendererEntry to a unified SurfaceDescriptor. */
function toSurfaceDescriptor(id: string, entry: RendererEntry): SurfaceDescriptor {
  return {
    id,
    title: entry.label,
    label: entry.label,
    icon: entry.icon,
    tag: entry.surface,
    placement: 'viewport' as Placement,
    presentation: {
      surface: entry.surface,
      controls: entry.controls,
      interactions: entry.interactions,
      parity: entry.parity,
      capabilities: entry.capabilities,
    } as RendererPresentation,
  };
}

/** The renderer catalog definition (backward-compatible shape). */
const RENDERER_CATALOG_DEFINITION = {
  '2d': {
    label: '2D Graph',
    icon: 'graph-2d',
    capabilities: {
      node: channels('color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z'),
      edge: channels('color', 'edge-color', 'width', 'line-style', 'opacity'),
    },
    parity: 'full' as const,
    surface: 'graph-surface',
    controls: ['layers'] as const,
    interactions: [
      'compose',
      'stream',
      'artifacts',
      'inspect',
      'explain',
      'select-context',
      'follow-up',
      'steer',
      'run-control',
      'palette',
      'structure-nav',
      'embed',
    ] as const,
  },
  '3d': {
    label: '3D Graph',
    icon: 'graph-3d',
    capabilities: {
      node: channels('color', 'opacity', 'size', 'label', 'z'),
      edge: channels('color', 'edge-color', 'width', 'opacity'),
    },
    parity: 'partial' as const,
    surface: 'graph3d-surface',
    interactions: [
      'compose',
      'stream',
      'inspect',
      'select-context',
      'palette',
      'structure-nav',
    ] as const,
  },
} as const;

/** Backward-compatible catalog using defineCatalog. */
export const RENDERER_DEFS = defineCatalog(RENDERER_CATALOG_DEFINITION);

/** The semantic id of a workspace renderer — the catalog keys are its source (D4). */
export type RendererId = keyof typeof RENDERER_DEFS.definition;

/** Every renderer id, in catalog order. */
export const RENDERER_IDS = RENDERER_DEFS.ids;

export type RendererEntryType = typeof RENDERER_DEFS.definition[RendererId];

export const rendererDef = (id: RendererId): RendererEntryType => RENDERER_DEFS.get(id);

/** The renderers a facet selects, in catalog order — the one way a partial set is read. */
export const rendererIdsWhere = (facet: (def: RendererEntryType) => boolean): RendererId[] =>
  RENDERER_DEFS.where(facet);

/** Register all renderers into the unified surface registry. */
export function registerRenderers(): void {
  for (const [id, entry] of Object.entries(RENDERER_CATALOG_DEFINITION)) {
    registerSurface(toSurfaceDescriptor(id, entry));
  }
}

/** Get a renderer as a unified surface descriptor. */
export const rendererSurface = (id: string): SurfaceDescriptor | undefined => {
  const surface = surfaceFor(id);
  if (!surface || surface.placement !== 'viewport') return undefined;
  return surface;
};

/** All renderer surfaces from the unified registry. */
export const rendererSurfaces = (): readonly SurfaceDescriptor[] =>
  surfacesByPlacement('viewport');

/** Re-export the unified registry for new code. */
export { surfaceRegistry, registerSurface, surfaceFor, getSurfaces, surfacesByPlacement, surfaceIdsByPlacement };
export type { SurfaceDescriptor, Placement, Presentation };