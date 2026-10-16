/**
 * Surface — the one mountable concept.
 *
 * A surface is a custom element with placement and presentation metadata.
 * Placement and presentation are parameters, so overlay/panel/renderer/viewport
 * collapse into one concept with one registry and one mount path.
 *
 * This replaces SurfaceDescriptor, OverlayDescriptor, PanelDef, RendererDef.
 */

import { createIdRegistry, type Registry } from '@senars/ui-contract/core';

/** Where the surface mounts in the app shell. */
export type Placement = 'viewport' | 'panel' | 'overlay' | 'inline';

/** Presentation options derived from placement. */
export interface Presentation {
  /** Dock position for panel placement. */
  readonly dock?: 'left' | 'right' | 'bottom' | 'float';
  /** Size in pixels (width for left/right, height for bottom). */
  readonly size?: number;
  /** Stack order within the dock. */
  readonly order?: number;
  /** Whether the overlay captures the background (modal). */
  readonly modal?: boolean;
  /** Focus the first focusable on open. */
  readonly autoFocus?: boolean;
  /** Hide from command palette. */
  readonly hiddenInPalette?: boolean;
  /** Window chrome options for overlay placement. */
  readonly window?: {
    readonly draggable?: boolean;
    readonly resizable?: boolean;
    readonly minimize?: boolean;
    readonly persist?: boolean;
  };
}

/** Base fields shared with Contribution (id, label, title, icon, group, capability, a11y). */
export interface SurfaceBase {
  /** Stable flat id: the test-API namespace and, by default, the element suffix. */
  readonly id: string;
  /** Human label for palettes, toolbar. */
  readonly label?: string;
  /** Icon name for tabs, toolbar (matches `s-icon` names). */
  readonly icon?: string;
  /** Human title for palettes, stories and docs. */
  readonly title: string;
  /** Explicit custom-element tag when the surface predates this contract. */
  readonly tag?: string;
  /** Contact-sheet / palette grouping. */
  readonly group?: string;
  /** Capability required to offer or open the surface; unmet => hidden/refused. */
  readonly capability?: string;
  /** Accessibility contract (role, name, keyboard path). */
  readonly a11y?: SurfaceA11y;
}

/** The unified surface descriptor. */
export interface SurfaceDescriptor extends SurfaceBase {
  /** Where this surface mounts. Defaults to 'overlay' for backward compatibility. */
  readonly placement?: Placement;
  /** Presentation options (dock, size, modal, window chrome, etc.). */
  readonly presentation?: Presentation;
  /** Store bindings the surface watches. */
  readonly bindings?: Readonly<Record<string, SurfaceBinding>>;
}

/** A readable the surface renders. */
export interface SurfaceSource {
  get(): unknown;
}

/** A readable that also notifies on change — what the surface lifecycle watches. */
export interface SurfaceBinding extends SurfaceSource {
  subscribe(fn: () => void): () => void;
}

/** Accessibility contract for the surface. */
export interface SurfaceA11y {
  /** ARIA role of the surface root (default `region`). */
  readonly role?: string;
  /** Accessible name (default the descriptor label). */
  readonly label?: string;
  /** Whether the surface is reachable by keyboard; opting out needs a reason. */
  readonly keyboard?: boolean;
  /** Why keyboard access is not provided, when `keyboard` is false. */
  readonly keyboardReason?: string;
}

/** The generic surface registry — one registry for all placements. */
export const surfaceRegistry: Registry<string, SurfaceDescriptor> = createIdRegistry();

/** Register a surface descriptor. */
export const registerSurface = (descriptor: SurfaceDescriptor): void => {
  surfaceRegistry.register(descriptor);
};

/** Clear the registry (test-only). */
export const resetSurfaces = (): void => surfaceRegistry.reset();

/** Get a surface descriptor by id. */
export const surfaceFor = (id: string): SurfaceDescriptor | undefined => surfaceRegistry.get(id);

/** All registered surfaces, in registration order. */
export const getSurfaces = (): readonly SurfaceDescriptor[] => surfaceRegistry.all();

/** Filter surfaces by a predicate on the descriptor. */
export const surfacesWhere = (predicate: (d: SurfaceDescriptor) => boolean): SurfaceDescriptor[] =>
  surfaceRegistry.all().filter(predicate);

/** Filter surface ids by a predicate on the descriptor. */
export const surfaceIdsWhere = (predicate: (d: SurfaceDescriptor) => boolean): string[] =>
  surfaceRegistry.all().filter(predicate).map((d) => d.id);

/** Get surfaces by placement. */
export const surfacesByPlacement = (placement: Placement): SurfaceDescriptor[] =>
  surfacesWhere((d) => d.placement === placement);

/** Get surface ids by placement. */
export const surfaceIdsByPlacement = (placement: Placement): string[] =>
  surfaceIdsWhere((d) => d.placement === placement);

/** Compute the custom-element tag for a surface. */
export const surfaceTag = (descriptor: SurfaceDescriptor): string =>
  descriptor.tag ?? `s-${descriptor.id}`;

/** Default presentation for a placement. */
export const defaultPresentation = (placement: Placement | undefined): Presentation => {
  switch (placement) {
    case 'panel':
      return { dock: 'right', size: 320, order: 0 };
    case 'overlay':
      return { modal: false, autoFocus: true };
    case 'viewport':
      return {};
    case 'inline':
      return {};
    default:
      return { modal: false, autoFocus: true }; // Default to overlay behavior
  }
};

/** Merge a descriptor's presentation with placement defaults. */
export const resolvedPresentation = (descriptor: SurfaceDescriptor): Presentation => ({
  ...defaultPresentation(descriptor.placement),
  ...descriptor.presentation,
});
