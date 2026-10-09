/**
 * The overlay host (§1, Phase 0.5): the shell-side owner of the one
 * `OverlayManager`. It lazily instantiates a registered overlay's element,
 * assigns the `Ref` it should inspect, and opens it under the manager's rules.
 * Keeping creation here — not in each caller — is what lets every overlay share
 * the stacking/focus/dismissal contract and lets the shell be the only module
 * that touches overlay elements.
 */

import { capabilityGate } from './capabilities.js';
import { OverlayManager } from './overlay-manager.js';
import { overlayDescriptor, type OverlayDescriptor } from './overlay-registry.js';

export interface OpenOverlayOptions {
  /** Element focus returns to when the overlay closes. */
  readonly anchor?: HTMLElement;
  /** The `Ref` the overlay inspects; assigned as the `ref` property before opening. */
  readonly ref?: string;
}

export class OverlayHost {
  readonly manager: OverlayManager;
  readonly #container: HTMLElement;
  readonly #elements = new Map<string, HTMLElement>();

  constructor(container: HTMLElement = document.body, doc: Document = document) {
    this.#container = container;
    this.manager = new OverlayManager(doc);
  }

  /** Open a registered overlay by id. Returns whether the id was known. */
  open(id: string, { anchor, ref }: OpenOverlayOptions = {}): boolean {
    const descriptor = overlayDescriptor(id);
    if (!descriptor) return false;
    if (descriptor.capability && !capabilityGate(descriptor.capability)) return false;
    const element = this.#element(descriptor);
    if (ref !== undefined) (element as { ref?: string }).ref = ref;
    const focused = this.#container.ownerDocument.activeElement as HTMLElement | null;
    this.manager.open({
      id,
      element,
      title: descriptor.title,
      // Callers may name an anchor (a HUD button); otherwise return focus to
      // whatever held it when the overlay opened, so graph/shortcut triggers
      // restore correctly without each caller knowing the focused element.
      anchor: anchor ?? focused ?? undefined,
      modal: descriptor.modal,
      autoFocus: descriptor.autoFocus,
      window: descriptor.window,
    });
    element.dispatchEvent(new CustomEvent('overlay-open', { detail: { id, ref } }));
    return true;
  }

  close(id?: string): boolean {
    return this.manager.close(id);
  }

  isOpen(id: string): boolean {
    return this.manager.isOpen(id);
  }

  stack(): string[] {
    return this.manager.stack();
  }

  element(id: string): HTMLElement | undefined {
    return this.#elements.get(id);
  }

  /** Minimize an overlay. */
  minimize(id: string): boolean {
    return this.manager.minimize(id);
  }

  /** Restore a minimized overlay. */
  restore(id: string): boolean {
    return this.manager.restore(id);
  }

  /** Toggle minimize/restore. */
  toggleMinimize(id: string): boolean {
    return this.manager.toggleMinimize(id);
  }

  /** Maximize an overlay. */
  maximize(id: string): boolean {
    return this.manager.maximize(id);
  }

  /** Restore a maximized overlay. */
  unmaximize(id: string): boolean {
    return this.manager.unmaximize(id);
  }

  /** Toggle maximize/restore. */
  toggleMaximize(id: string): boolean {
    return this.manager.toggleMaximize(id);
  }

  /** Cascade open windows. */
  cascade(offset?: number): void {
    this.manager.cascade(offset);
  }

  /** Tile open windows in a grid. */
  tile(): void {
    this.manager.tile();
  }

  dispose(): void {
    this.manager.dispose();
    for (const element of this.#elements.values()) element.remove();
    this.#elements.clear();
  }

  #element(descriptor: OverlayDescriptor): HTMLElement {
    const existing = this.#elements.get(descriptor.id);
    if (existing) return existing;
    const element = this.#container.ownerDocument.createElement(descriptor.tag);
    element.hidden = true;
    this.#container.appendChild(element);
    this.#elements.set(descriptor.id, element);
    return element;
  }
}
