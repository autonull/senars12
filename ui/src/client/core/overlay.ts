/**
 * The overlay component contract. An overlay is a surface the shell mounts
 * lazily into the overlay host. The descriptor declares id, title, tag, modal,
 * capability, and window options; `defineOverlay` registers it and defines the
 * custom element.
 *
 * Built on `defineContribution` (E3) — the one registration HOC.
 */

import { BaseComponent } from './base-component.js';
import { overlayRegistry, type OverlayDescriptor } from './overlay-registry.js';
import { createDefineTagged } from './define-contribution.js';

/** An overlay component extends BaseComponent and receives its descriptor. */
export type OverlayClass<T extends BaseComponent = BaseComponent> = new () => T;

/**
 * Bind a descriptor to an overlay class and define its custom element once.
 * Registration and the custom element both derive from the descriptor.
 *
 * Now built on `defineContribution` (E3) — the one registration HOC.
 */
export const defineOverlay = createDefineTagged<OverlayDescriptor>(overlayRegistry, BaseComponent);