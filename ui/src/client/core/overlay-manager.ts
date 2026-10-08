/**
 * The one overlay manager (§1, Phase 0.5). The workspace is a single surface;
 * everything else — palette, inspector, explanation popover, ToC, artifact
 * viewer, dialogs — is an overlay on it. This owns the rules that are easy to
 * get wrong when each caller improvises: a stacking order, `Esc` closing the
 * topmost overlay, focus returning to the anchor, outside-click dismissing
 * non-modals, and a focus trap on every overlay. Pinning is a seam: a pinned
 * overlay is a floating card that `Esc`/outside-click leave alone.
 */

import { FocusTrap } from './focus-trap.js';

export interface OverlayEntry {
  readonly id: string;
  readonly element: HTMLElement;
  /** Element focus returns to when the overlay closes. */
  readonly anchor?: HTMLElement;
  /** A modal captures the background: outside-click is ignored. */
  readonly modal?: boolean;
  /** Focus the first focusable on open. Off for popovers that follow live selection. */
  readonly autoFocus?: boolean;
}

interface OpenOverlay extends OverlayEntry {
  readonly trap: FocusTrap;
  pinned: boolean;
}

const BASE_Z = 1000;

export class OverlayManager {
  readonly #doc?: Document;
  readonly #stack: OpenOverlay[] = [];
  #onKeyDown = (event: KeyboardEvent): void => this.#handleKeyDown(event);
  #onPointerDown = (event: Event): void => this.#handlePointerDown(event);

  constructor(doc: Document | undefined = globalThis.document) {
    this.#doc = doc;
    doc?.addEventListener('keydown', this.#onKeyDown, true);
    doc?.addEventListener('mousedown', this.#onPointerDown, true);
  }

  open(entry: OverlayEntry): void {
    const index = this.#stack.findIndex((open) => open.id === entry.id);
    if (index >= 0) {
      const [existing] = this.#stack.splice(index, 1);
      if (!existing) return;
      existing.element.hidden = false;
      this.#stack.push(existing);
      this.#restack();
      return;
    }
    entry.element.hidden = false;
    const overlay: OpenOverlay = {
      ...entry,
      trap: new FocusTrap(entry.element, entry.autoFocus ?? true),
      pinned: false,
    };
    overlay.trap.activate();
    this.#stack.push(overlay);
    this.#restack();
  }

  /** Close the overlay with `id`, or the topmost when omitted. Returns whether one closed. */
  close(id?: string): boolean {
    const index = id
      ? this.#stack.findIndex((overlay) => overlay.id === id)
      : this.#stack.length - 1;
    if (index < 0) return false;
    const [overlay] = this.#stack.splice(index, 1);
    if (!overlay) return false;
    overlay.trap.dispose();
    overlay.element.hidden = true;
    overlay.anchor?.focus();
    this.#restack();
    return true;
  }

  closeTop(): boolean {
    const top = this.#top();
    return top ? this.close(top.id) : false;
  }

  isOpen(id: string): boolean {
    return this.#stack.some((overlay) => overlay.id === id);
  }

  /** Overlay ids from bottom to top. */
  stack(): string[] {
    return this.#stack.map((overlay) => overlay.id);
  }

  size(): number {
    return this.#stack.length;
  }

  setPinned(id: string, pinned: boolean): void {
    const overlay = this.#stack.find((open) => open.id === id);
    if (overlay) overlay.pinned = pinned;
  }

  pinned(): string[] {
    return this.#stack.filter((overlay) => overlay.pinned).map((overlay) => overlay.id);
  }

  dispose(): void {
    for (const overlay of [...this.#stack].reverse()) this.close(overlay.id);
    this.#doc?.removeEventListener('keydown', this.#onKeyDown, true);
    this.#doc?.removeEventListener('mousedown', this.#onPointerDown, true);
  }

  #top(): OpenOverlay | undefined {
    return this.#stack[this.#stack.length - 1];
  }

  #restack(): void {
    this.#stack.forEach((overlay, index) => {
      overlay.element.style.zIndex = String(BASE_Z + index);
    });
  }

  #handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const top = [...this.#stack].reverse().find((overlay) => !overlay.pinned);
    if (!top) return;
    event.preventDefault();
    this.close(top.id);
  }

  #handlePointerDown(event: Event): void {
    const top = this.#top();
    if (!top || top.modal || top.pinned) return;
    // `composedPath` so a click on a shadow-DOM anchor is recognised as inside.
    const path = event.composedPath();
    if (path.includes(top.element) || (top.anchor !== undefined && path.includes(top.anchor)))
      return;
    this.close(top.id);
  }
}
