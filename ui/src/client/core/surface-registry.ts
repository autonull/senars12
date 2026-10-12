/**
 * The surface registry: the pure, DOM-free half of the surface contract. A
 * `SurfaceDescriptor` is data, so it can be enumerated by generators (stories,
 * gallery cells, a11y targets, docs) without importing a `LitElement`. The
 * component half (`surface.ts`) registers here when `defineSurface` runs.
 */

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
  /** Accessible name (default the descriptor title). */
  label?: string;
  /** Whether the surface is reachable by keyboard; opting out needs a reason. */
  keyboard?: boolean;
  /** Why keyboard access is not provided, when `keyboard` is false. */
  keyboardReason?: string;
}

export interface SurfaceDescriptor {
  /** Stable flat id: the test-API namespace and, by default, the element suffix. */
  id: string;
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

export const surfaceTag = (descriptor: SurfaceDescriptor): string =>
  descriptor.tag ?? `s-${descriptor.id}`;

const registry = new Map<string, SurfaceDescriptor>();

export const registerSurface = (descriptor: SurfaceDescriptor): void => {
  registry.set(descriptor.id, descriptor);
};

/** Every registered surface, in registration order. */
export const getSurfaces = (): SurfaceDescriptor[] => [...registry.values()];

export const surfaceFor = (id: string): SurfaceDescriptor | undefined => registry.get(id);