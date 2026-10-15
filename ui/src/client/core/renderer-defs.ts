/**
 * Renderer definitions — a view onto the workspace renderer registry (A0.1).
 *
 * A renderer is a surface with `placement: 'viewport'`. This module provides
 * backward-compatible APIs while the workspace renderer registry is the single
 * source. Canonical renderer ids: `graph-2d`, `graph-3d`, `notebook`.
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
import {
  workspaceRenderers,
  workspaceRendererIds,
  workspaceRenderer,
  type WorkspaceRenderer,
} from './workspace-renderer.js';

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

/** Known renderer ids — the static type source (A0.1, D3). */
export const KNOWN_RENDERER_IDS = ['graph-2d', 'graph-3d', 'notebook'] as const;
export type RendererId = (typeof KNOWN_RENDERER_IDS)[number];

/** Static type-only catalog definition for type inference. */
const STATIC_RENDERER_CATALOG = {
  'graph-2d': {
    label: '2D Graph',
    icon: 'graph-2d',
    capabilities: {
      node: new Set<Channel>(['color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z']),
      edge: new Set<Channel>(['color', 'edge-color', 'width', 'line-style', 'opacity']),
    },
    parity: 'full' as const,
    surface: 'graph-surface',
    controls: ['layers'] as const,
    interactions: ['compose', 'stream', 'artifacts', 'inspect', 'explain', 'select-context', 'follow-up', 'steer', 'run-control', 'palette', 'structure-nav', 'embed'] as const,
  },
  'graph-3d': {
    label: '3D Graph',
    icon: 'graph-3d',
    capabilities: {
      node: new Set<Channel>(['color', 'opacity', 'size', 'label', 'z']),
      edge: new Set<Channel>(['color', 'edge-color', 'width', 'opacity']),
    },
    parity: 'partial' as const,
    surface: 'graph3d-surface',
    interactions: ['compose', 'stream', 'inspect', 'select-context', 'palette', 'structure-nav'] as const,
  },
  'notebook': {
    label: 'Notebook',
    icon: 'notebook',
    capabilities: { node: new Set<Channel>(), edge: new Set<Channel>() },
    parity: 'full' as const,
    surface: 'notebook-surface',
    interactions: ['compose', 'stream', 'artifacts', 'inspect', 'explain', 'select-context', 'follow-up', 'steer', 'run-control', 'palette'] as const,
  },
} as const satisfies Record<RendererId, RendererEntry>;

/** Backward-compatible catalog using defineCatalog (for types). */
export const RENDERER_DEFS = defineCatalog(STATIC_RENDERER_CATALOG);

/** Every renderer id, in catalog order. */
export const RENDERER_IDS = RENDERER_DEFS.ids;

export type RendererEntryType = typeof RENDERER_DEFS.definition[RendererId];

export const rendererDef = (id: RendererId): RendererEntryType => RENDERER_DEFS.get(id);

/** The renderers a facet selects, in catalog order — the one way a partial set is read. */
export const rendererIdsWhere = (facet: (def: RendererEntryType) => boolean): RendererId[] =>
  RENDERER_DEFS.where(facet);

/** Convert a WorkspaceRenderer to a backward-compatible RendererEntry. */
function toRendererEntry(renderer: WorkspaceRenderer): RendererEntry {
  const caps = renderer.capabilities();
  return {
    label: renderer.label,
    icon: renderer.id,
    capabilities: caps.channels ?? { node: new Set(), edge: new Set() },
    parity: caps.parity,
    surface: caps.surface ?? renderer.id,
    controls: caps.controls,
    interactions: caps.interactions as readonly string[],
  };
}

/** Convert a WorkspaceRenderer to a unified SurfaceDescriptor. */
function toSurfaceDescriptor(renderer: WorkspaceRenderer): SurfaceDescriptor {
  const entry = toRendererEntry(renderer);
  return {
    id: renderer.id,
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

/** Register all renderers into the unified surface registry (called at startup). */
export function registerRenderers(): void {
  for (const renderer of workspaceRenderers()) {
    registerSurface(toSurfaceDescriptor(renderer));
  }
}

/** Get a renderer as a unified surface descriptor. */
export const rendererSurface = (id: string): SurfaceDescriptor | undefined => {
  const surface = surfaceFor(id);
  if (!surface || surface.placement !== 'viewport') return undefined;
  return surface;
}

/** All renderer surfaces from the unified registry. */
export const rendererSurfaces = (): readonly SurfaceDescriptor[] =>
  surfacesByPlacement('viewport');

/** Get the live renderer catalog (derived from workspace renderer registry). */
export function getLiveRendererCatalog(): Record<string, RendererEntry> {
  const definition: Record<string, RendererEntry> = {};
  for (const renderer of workspaceRenderers()) {
    definition[renderer.id] = toRendererEntry(renderer);
  }
  return definition;
}

/** Re-export the unified registry for new code. */
export { surfaceRegistry, registerSurface, surfaceFor, getSurfaces, surfacesByPlacement, surfaceIdsByPlacement };
export type { SurfaceDescriptor, Placement, Presentation };

/** Re-export workspace renderer registry functions for direct access. */
export { workspaceRenderers, workspaceRendererIds, workspaceRenderer };
export type { WorkspaceRenderer } from './workspace-renderer.js';