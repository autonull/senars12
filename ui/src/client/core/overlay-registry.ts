/**
 * The overlay registry — now a view onto the unified surface registry (P2).
 *
 * An overlay is a surface with `placement: 'overlay'`. This module provides
 * backward-compatible APIs while the unified registry is the single source.
 */

import type { Capability } from './capabilities.js';
import {
  surfaceRegistry,
  registerSurface,
  surfaceFor,
  getSurfaces,
  surfacesByPlacement,
  surfaceIdsByPlacement,
  type SurfaceDescriptor,
  type Presentation,
  type Placement,
  type SurfaceA11y,
} from '../framework/surface.js';
import { createIdRegistry, type Registry } from './registry.js';

/** Window chrome options for overlay placement. */
export interface OverlayWindowOptions {
  /** Enable drag-to-reposition via header drag-handle. */
  readonly draggable?: boolean;
  /** Enable resize via corner grip. */
  readonly resizable?: boolean;
  /** Enable minimize to badge. */
  readonly minimize?: boolean;
  /** Persist position/size/pinned state to sessionStorage. */
  readonly persist?: boolean;
}

/** Overlay-specific presentation options (subset of unified Presentation). */
export interface OverlayPresentation extends Presentation {
  readonly modal?: boolean;
  readonly autoFocus?: boolean;
  readonly hiddenInPalette?: boolean;
  readonly window?: OverlayWindowOptions;
}

/** Backward-compatible overlay descriptor. */
export interface OverlayDescriptor {
  /** Stable flat id. */
  readonly id: string;
  /** Human label for palettes, toolbar. */
  readonly label?: string;
  /** Icon name for tabs, toolbar (matches `s-icon` names). */
  readonly icon?: string;
  /** Human title for palettes, stories and docs. */
  readonly title: string;
  /** Custom-element tag that implements the overlay. */
  readonly tag: string;
  /** @deprecated Use presentation.modal */
  readonly modal?: boolean;
  /** @deprecated Use presentation.autoFocus */
  readonly autoFocus?: boolean;
  /** @deprecated Use presentation.hiddenInPalette */
  readonly hiddenInPalette?: boolean;
  /** Capability required to offer or open the overlay; unmet => hidden/refused. */
  readonly capability?: Capability;
  /** @deprecated Use presentation.window */
  readonly window?: OverlayWindowOptions;
  /** Contact-sheet / palette grouping. */
  readonly group?: string;
  /** Accessibility contract (role, name, keyboard path). */
  readonly a11y?: SurfaceA11y;
}

/** Convert a legacy OverlayDescriptor to a unified SurfaceDescriptor. */
function toSurfaceDescriptor(descriptor: OverlayDescriptor): SurfaceDescriptor {
  // Preserve a11y from existing surface if already registered (e.g. via defineSurface)
  const existing = surfaceFor(descriptor.id);
  const { modal, autoFocus, hiddenInPalette, window, tag, ...rest } = descriptor;
  return {
    ...rest,
    id: descriptor.id,
    title: descriptor.title,
    tag: descriptor.tag,
    placement: 'overlay' as Placement,
    a11y: descriptor.a11y ?? existing?.a11y,
    presentation: {
      modal,
      autoFocus,
      hiddenInPalette,
      window,
    } as OverlayPresentation,
  };
}

/** Register an overlay (stores as a surface with placement='overlay'). */
export const registerOverlay = (descriptor: OverlayDescriptor): void => {
  const existing = surfaceFor(descriptor.id);
  const surfaceDescriptor = toSurfaceDescriptor(descriptor);
  // Merge presentation with existing surface if it exists
  if (existing) {
    registerSurface({
      ...existing,
      ...surfaceDescriptor,
      presentation: {
        ...existing.presentation,
        ...surfaceDescriptor.presentation,
      },
      a11y: existing.a11y ?? surfaceDescriptor.a11y,
    });
  } else {
    registerSurface(surfaceDescriptor);
  }
};

/** Get an overlay descriptor by id (converted from surface). */
export const overlayDescriptor = (id: string): OverlayDescriptor | undefined => {
  const surface = surfaceFor(id);
  if (!surface || surface.placement !== 'overlay') return undefined;
  return fromSurfaceDescriptor(surface);
};

/** All overlay descriptors (filtered from unified registry). */
export const overlays = (): readonly OverlayDescriptor[] =>
  surfacesByPlacement('overlay').map(fromSurfaceDescriptor);

/** Convert a unified SurfaceDescriptor to a legacy OverlayDescriptor. */
function fromSurfaceDescriptor(surface: SurfaceDescriptor): OverlayDescriptor {
  const p = surface.presentation as OverlayPresentation | undefined;
  return {
    id: surface.id,
    label: surface.label,
    icon: surface.icon,
    title: surface.title,
    tag: surface.tag ?? `s-${surface.id}`,
    modal: p?.modal,
    autoFocus: p?.autoFocus,
    hiddenInPalette: p?.hiddenInPalette,
    capability: (surface as SurfaceDescriptor & { capability?: Capability }).capability,
    window: p?.window as OverlayWindowOptions | undefined,
    group: surface.group,
  };
}

/** Backward-compatible overlay registry (wraps unified surface registry). */
export const overlayRegistry: Registry<string, OverlayDescriptor> = createIdRegistry();

/** Re-export the unified registry for new code. */
export { surfaceRegistry, registerSurface, surfaceFor, getSurfaces, surfacesByPlacement, surfaceIdsByPlacement };
export type { SurfaceDescriptor, Placement, Presentation };