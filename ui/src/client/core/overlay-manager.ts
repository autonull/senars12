/**
 * The one overlay manager (§1, Phase 0.5). The workspace is a single surface;
 * everything else — palette, inspector, explanation popover, ToC, artifact
 * viewer, dialogs — is an overlay on it. This owns the rules that are easy to
 * get wrong when each caller improvises: a stacking order, `Esc` closing the
 * topmost overlay, focus returning to the anchor, outside-click dismissing
 * non-modals, and a focus trap on every overlay. A `modal` additionally paints a
 * **scrim** below it, which captures pointer input so the workspace behind
 * cannot be driven while a dialog owns the screen. Pinning is a seam: a pinned
 * overlay is a floating card that `Esc`/outside-click leave alone.
 */

import { Announcer } from './announcer.js';
import { FocusTrap } from './focus-trap.js';

export interface OverlayEntry {
  readonly id: string;
  readonly element: HTMLElement;
  /** Human label announced to assistive tech for focus-less popovers. */
  readonly title?: string;
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
/** Overlays are spaced two apart so the scrim has a layer to sit in beneath a modal. */
const Z_STRIDE = 2;

export class OverlayManager {
  readonly #doc?: Document;
  readonly #stack: OpenOverlay[] = [];
  #scrim?: HTMLElement;
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
    entry.element.toggleAttribute('data-pinned', false);
    const overlay: OpenOverlay = {
      ...entry,
      trap: new FocusTrap(entry.element, entry.autoFocus ?? true),
      pinned: false,
    };
    overlay.trap.activate();
    this.#stack.push(overlay);
    this.#restack();
    // Focus-moving overlays are announced by their own dialog semantics; only
    // focus-less popovers need an explicit cue that they appeared.
    if (overlay.autoFocus === false) {
      Announcer.getInstance().announce(`${overlay.title ?? overlay.id} opened`);
    }
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
    if (overlay.autoFocus === false) {
      Announcer.getInstance().announce(`${overlay.title ?? overlay.id} closed`);
    }
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

  /** Whether any open overlay declares itself modal (captures the background). */
  hasModal(): boolean {
    return this.#stack.some((overlay) => overlay.modal === true);
  }

  /**
   * Whether focus currently sits inside an open overlay. Background shortcuts
   * (graph `j`/`k`) stay live for focus-less popovers but must yield while a
   * dialog owns focus.
   */
  containsFocus(): boolean {
    const active = this.#doc?.activeElement;
    if (!active) return false;
    return this.#stack.some(
      (overlay) => overlay.element === active || overlay.element.contains(active)
    );
  }

  setPinned(id: string, pinned: boolean): void {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay || overlay.pinned === pinned) return;
    overlay.pinned = pinned;
    overlay.element.toggleAttribute('data-pinned', pinned);
    Announcer.getInstance().announce(`${overlay.title ?? id} ${pinned ? 'pinned' : 'unpinned'}`);
  }

  pinned(): string[] {
    return this.#stack.filter((overlay) => overlay.pinned).map((overlay) => overlay.id);
  }

  dispose(): void {
    for (const overlay of [...this.#stack].reverse()) this.close(overlay.id);
    this.#doc?.removeEventListener('keydown', this.#onKeyDown, true);
    this.#doc?.removeEventListener('mousedown', this.#onPointerDown, true);
    this.#scrim = undefined;
  }

  #top(): OpenOverlay | undefined {
    return this.#stack[this.#stack.length - 1];
  }

  #restack(): void {
    this.#stack.forEach((overlay, index) => {
      overlay.element.style.zIndex = String(BASE_Z + index * Z_STRIDE);
    });
    this.#syncScrim();
  }

  /**
   * Paint the scrim beneath the lowest open modal, and take it away when none is
   * left. It swallows pointer input (`pointer-events: auto` over the whole
   * viewport) rather than reacting to it: a modal is dismissed by its own
   * controls or `Esc`, never by a click that happened to land on its backdrop.
   */
  #syncScrim(): void {
    const index = this.#stack.findIndex((overlay) => overlay.modal === true);
    if (index < 0) {
      this.#scrim?.remove();
      this.#scrim = undefined;
      return;
    }
    const doc = this.#doc;
    if (!doc?.body) return;
    let scrim = this.#scrim;
    if (!scrim) {
      scrim = doc.createElement('div');
      this.#scrim = scrim;
      scrim.className = 'overlay-scrim';
      scrim.setAttribute('aria-hidden', 'true');
      scrim.onmousedown = (event) => event.stopPropagation();
    }
    scrim.style.zIndex = String(BASE_Z + index * Z_STRIDE - 1);
    if (!scrim.isConnected) doc.body.appendChild(scrim);
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

/** Global singleton instance — lazy-initialized on first access. */
let _overlayManager: OverlayManager | undefined;

export function getOverlayManager(doc?: Document): OverlayManager {
  if (!_overlayManager) _overlayManager = new OverlayManager(doc);
  return _overlayManager;
}

/** Reset the singleton (for testing). */
export function resetOverlayManager(): void {
  _overlayManager?.dispose();
  _overlayManager = undefined;
}
