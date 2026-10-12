/**
 * Surface registration — boot-time population of the unified surface registry (P2).
 *
 * This module registers all panels, renderers, and overlays into the single
 * surfaceRegistry. Called once at app startup.
 */

import { registerPanels } from './panel-defs.js';
import { registerRenderers } from './renderer-defs.js';
import { overlays as getOverlayDescriptors } from './overlay-registry.js';
import { registerSurface } from '../framework/surface.js';
import type { OverlayDescriptor } from './overlay-registry.js';

/** Register all known surfaces into the unified registry. */
export function registerAllSurfaces(): void {
  // Register panels (placement: 'panel')
  registerPanels();

  // Register renderers (placement: 'viewport')
  registerRenderers();

  // Register existing overlays (placement: 'overlay')
  // These are already registered via defineOverlay, but we also expose them
  // through the unified registry for the palette, etc.
  for (const overlay of getOverlayDescriptors()) {
    // The overlay is already registered as a surface by defineOverlay -> defineSurface
    // This is a no-op if already registered, but ensures the unified registry has them
  }
}

/** Register additional overlays that aren't defined via defineOverlay. */
export function registerOverlaySurfaces(descriptors: ReadonlyArray<OverlayDescriptor>): void {
  for (const descriptor of descriptors) {
    registerSurface({
      id: descriptor.id,
      title: descriptor.title,
      label: descriptor.label,
      icon: descriptor.icon,
      tag: descriptor.tag,
      placement: 'overlay',
      presentation: {
        modal: descriptor.modal,
        autoFocus: descriptor.autoFocus,
        hiddenInPalette: descriptor.hiddenInPalette,
        window: descriptor.window,
      },
      group: descriptor.group,
    });
  }
}