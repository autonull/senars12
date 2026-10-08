/**
 * The overlay registry (§1, Phase 1.5). An overlay is an ordinary surface
 * (descriptor + element) the shell mounts lazily into the overlay host and opens
 * through the one `OverlayManager`. The registry is data, so the palette,
 * shortcuts and tests can enumerate overlays without importing their elements;
 * `modal` marks the ones that capture the background.
 */

export interface OverlayDescriptor {
  readonly id: string;
  readonly title: string;
  /** Custom-element tag that implements the overlay. */
  readonly tag: string;
  /** A modal captures the background: outside-click is ignored. */
  readonly modal?: boolean;
  /** Focus the first focusable on open. Off for popovers that follow live selection. */
  readonly autoFocus?: boolean;
  /** Keep the overlay out of the command palette (e.g. the palette itself). */
  readonly hiddenInPalette?: boolean;
}

const registry = new Map<string, OverlayDescriptor>();

export const registerOverlay = (descriptor: OverlayDescriptor): void => {
  registry.set(descriptor.id, descriptor);
};

export const overlayDescriptor = (id: string): OverlayDescriptor | undefined => registry.get(id);

export const overlays = (): OverlayDescriptor[] => [...registry.values()];
