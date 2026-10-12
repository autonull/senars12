/**
 * The surface registry: the pure, DOM-free half of the surface contract. A
 * `SurfaceDescriptor` is data, so it can be enumerated by generators (stories,
 * gallery cells, a11y targets, docs) without importing a `LitElement`. The
 * component half (`surface.ts`) registers here when `defineSurface` runs.
 *
 * Now built on `createRegistry` (E2) — the generic registry shape.
 */

import { createIdRegistry, type Registry } from './registry.js';
import type { Contribution } from './contribution.js';

/** A readable the surface renders. */
export interface SurfaceSource {
  get(): unknown;
}

/** A readable that also notifies on change — what the surface lifecycle watches. */
export interface SurfaceBinding extends SurfaceSource {
  subscribe(fn: () => void): () => void;
}

/** The accessibility a surface declares, so the codegen/story/gate read one source. */
export interface SurfaceA11y {
  /** ARIA role of the surface root (default `region`). */
  role?: string;
  /** Accessible name (default the descriptor label). */
  label?: string;
  /** Whether the surface is reachable by keyboard; opting out needs a reason. */
  keyboard?: boolean;
  /** Why keyboard access is not provided, when `keyboard` is false. */
  keyboardReason?: string;
}

export interface SurfaceDescriptor {
  /** Stable flat id: the test-API namespace and, by default, the element suffix. */
  id: string;
  /** Human label for palettes, toolbar. */
  label?: string;
  /** Icon name for tabs, toolbar (matches `s-icon` names). */
  icon?: string;
  /** Human title for palettes, stories and docs. */
  title: string;
  /** Explicit custom-element tag when the surface predates this contract. */
  tag?: string;
  /** Contact-sheet / palette grouping. */
  group?: string;
  /** The data the surface renders: watched on change and snapshotted by its reflective API. */
  bindings?: Readonly<Record<string, SurfaceBinding>>;
  /** The surface's accessibility contract (role, name, keyboard path). */
  a11y?: SurfaceA11y;
}

/** The generic surface registry. */
export const surfaceRegistry: Registry<string, SurfaceDescriptor> = createIdRegistry();

export const registerSurface = (descriptor: SurfaceDescriptor): void => {
  surfaceRegistry.register(descriptor);
};

/** Every registered surface, in registration order. */
export const getSurfaces = (): readonly SurfaceDescriptor[] => surfaceRegistry.all();

export const surfaceFor = (id: string): SurfaceDescriptor | undefined => surfaceRegistry.get(id);

export const surfaceTag = (descriptor: SurfaceDescriptor): string =>
  descriptor.tag ?? `s-${descriptor.id}`;