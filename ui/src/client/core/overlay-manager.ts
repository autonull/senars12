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
 *
 * Window management (§overlay-windows): tracks bounds (position/size), handles
 * drag/resize from overlay-header, minimize/maximize, cascade/tile, and
 * sessionStorage persistence.
 */

import { Announcer } from './announcer.js';
import { FocusTrap } from './focus-trap.js';

export interface OverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  /** Window options: draggable, resizable, minimize, persist. */
  readonly window?: {
    readonly draggable?: boolean;
    readonly resizable?: boolean;
    readonly minimize?: boolean;
    readonly persist?: boolean;
  };
}

interface OpenOverlay extends OverlayEntry {
  readonly trap: FocusTrap;
  pinned: boolean;
  bounds: OverlayBounds;
  minimized: boolean;
  maximized: boolean;
  previousBounds?: OverlayBounds;
}

const BASE_Z = 1000;
/** Overlays are spaced two apart so the scrim has a layer to sit in beneath a modal. */
const Z_STRIDE = 2;
const STORAGE_KEY = 'senars:overlay-bounds';
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

function loadBounds(): Record<string, OverlayBounds> {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveBounds(bounds: Record<string, OverlayBounds>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bounds));
  } catch {
    // Ignore quota/access errors
  }
}

export class OverlayManager {
  readonly #doc?: Document;
  readonly #stack: OpenOverlay[] = [];
  #scrim?: HTMLElement;
  #onKeyDown = (event: KeyboardEvent): void => this.#handleKeyDown(event);
  #onPointerDown = (event: Event): void => this.#handlePointerDown(event);
  #bounds = loadBounds();
  #dragState: { overlay: OpenOverlay; startX: number; startY: number; startLeft: number; startTop: number } | null = null;
  #resizeState: { overlay: OpenOverlay; startX: number; startY: number; startWidth: number; startHeight: number } | null = null;

  constructor(doc: Document | undefined = globalThis.document) {
    this.#doc = doc;
    doc?.addEventListener('keydown', this.#onKeyDown, true);
    doc?.addEventListener('mousedown', this.#onPointerDown, true);
    doc?.addEventListener('mousemove', this.#onDocumentMouseMove);
    doc?.addEventListener('mouseup', this.#onDocumentMouseUp);
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
    entry.element.toggleAttribute('data-minimized', false);
    entry.element.toggleAttribute('data-maximized', false);

    // Load saved bounds or use defaults
    const saved = this.#bounds[entry.id];
    const bounds: OverlayBounds = saved ?? {
      x: 50 + this.#stack.length * 20,
      y: 50 + this.#stack.length * 20,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };

    const overlay: OpenOverlay = {
      ...entry,
      trap: new FocusTrap(entry.element, entry.autoFocus ?? true),
      pinned: false,
      bounds,
      minimized: false,
      maximized: false,
    };
    overlay.trap.activate();
    this.#applyBounds(overlay);
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
    if (pinned && overlay.window?.persist) this.#persist(overlay);
  }

  pinned(): string[] {
    return this.#stack.filter((overlay) => overlay.pinned).map((overlay) => overlay.id);
  }

  /** Minimize an overlay to its header badge. */
  minimize(id: string): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay || overlay.minimized) return false;
    if (!overlay.window?.minimize) return false;
    overlay.previousBounds = { ...overlay.bounds };
    overlay.minimized = true;
    overlay.element.toggleAttribute('data-minimized', true);
    overlay.trap.deactivate();
    Announcer.getInstance().announce(`${overlay.title ?? id} minimized`);
    if (overlay.window?.persist) this.#persist(overlay);
    return true;
  }

  /** Restore a minimized overlay. */
  restore(id: string): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay || !overlay.minimized) return false;
    overlay.minimized = false;
    overlay.element.toggleAttribute('data-minimized', false);
    overlay.trap.activate();
    Announcer.getInstance().announce(`${overlay.title ?? id} restored`);
    if (overlay.window?.persist) this.#persist(overlay);
    return true;
  }

  /** Toggle minimize/restore. */
  toggleMinimize(id: string): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay) return false;
    return overlay.minimized ? this.restore(id) : this.minimize(id);
  }

  /** Maximize an overlay to fill the viewport. */
  maximize(id: string): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay || overlay.maximized) return false;
    if (!overlay.window?.minimize) return false; // reuse minimize flag for window controls
    overlay.previousBounds = { ...overlay.bounds };
    overlay.maximized = true;
    overlay.element.toggleAttribute('data-maximized', true);
    const doc = this.#doc;
    if (doc) {
      overlay.bounds = { x: 0, y: 0, width: doc.documentElement.clientWidth, height: doc.documentElement.clientHeight };
      this.#applyBounds(overlay);
    }
    Announcer.getInstance().announce(`${overlay.title ?? id} maximized`);
    if (overlay.window?.persist) this.#persist(overlay);
    return true;
  }

  /** Restore a maximized overlay. */
  unmaximize(id: string): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay || !overlay.maximized) return false;
    overlay.maximized = false;
    overlay.element.toggleAttribute('data-maximized', false);
    if (overlay.previousBounds) {
      overlay.bounds = { ...overlay.previousBounds };
      this.#applyBounds(overlay);
    }
    Announcer.getInstance().announce(`${overlay.title ?? id} restored`);
    if (overlay.window?.persist) this.#persist(overlay);
    return true;
  }

  /** Toggle maximize/restore. */
  toggleMaximize(id: string): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay) return false;
    return overlay.maximized ? this.unmaximize(id) : this.maximize(id);
  }

  /** Get current bounds for an overlay. */
  getBounds(id: string): OverlayBounds | undefined {
    const overlay = this.#stack.find((open) => open.id === id);
    return overlay?.bounds;
  }

  /** Set bounds for an overlay (used by drag/resize handlers). */
  setBounds(id: string, bounds: Partial<OverlayBounds>): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay || overlay.minimized || overlay.maximized) return false;
    overlay.bounds = { ...overlay.bounds, ...bounds };
    this.#applyBounds(overlay);
    if (overlay.window?.persist) this.#persist(overlay);
    return true;
  }

  /** Cascade open windows with offset. */
  cascade(offset = 30): void {
    const windows = this.#stack.filter((o) => o.window?.draggable && !o.minimized && !o.maximized);
    windows.forEach((overlay, index) => {
      overlay.bounds = {
        x: 50 + index * offset,
        y: 50 + index * offset,
        width: overlay.bounds.width,
        height: overlay.bounds.height,
      };
      this.#applyBounds(overlay);
      if (overlay.window?.persist) this.#persist(overlay);
    });
  }

  /** Tile open windows in a grid. */
  tile(): void {
    const windows = this.#stack.filter((o) => o.window?.draggable && !o.minimized && !o.maximized);
    if (windows.length === 0) return;
    const doc = this.#doc;
    const vw = doc?.documentElement.clientWidth ?? 1200;
    const vh = doc?.documentElement.clientHeight ?? 800;
    const cols = Math.ceil(Math.sqrt(windows.length));
    const rows = Math.ceil(windows.length / cols);
    const cellW = vw / cols;
    const cellH = vh / rows;
    windows.forEach((overlay, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      overlay.bounds = {
        x: col * cellW,
        y: row * cellH,
        width: cellW,
        height: cellH,
      };
      this.#applyBounds(overlay);
      if (overlay.window?.persist) this.#persist(overlay);
    });
  }

  dispose(): void {
    for (const overlay of [...this.#stack].reverse()) this.close(overlay.id);
    this.#doc?.removeEventListener('keydown', this.#onKeyDown, true);
    this.#doc?.removeEventListener('mousedown', this.#onPointerDown, true);
    this.#doc?.removeEventListener('mousemove', this.#onDocumentMouseMove);
    this.#doc?.removeEventListener('mouseup', this.#onDocumentMouseUp);
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
    if (!top || top.modal || top.pinned || top.minimized || top.maximized) return;
    // `composedPath` so a click on a shadow-DOM anchor is recognised as inside.
    const path = event.composedPath();
    if (path.includes(top.element) || (top.anchor !== undefined && path.includes(top.anchor)))
      return;
    this.close(top.id);
  }

  #onDocumentMouseMove = (event: MouseEvent): void => {
    if (this.#dragState) {
      const { overlay, startX, startY, startLeft, startTop } = this.#dragState;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      overlay.bounds.x = startLeft + dx;
      overlay.bounds.y = startTop + dy;
      this.#applyBounds(overlay);
    }
    if (this.#resizeState) {
      const { overlay, startX, startY, startWidth, startHeight } = this.#resizeState;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      overlay.bounds.width = Math.max(MIN_WIDTH, startWidth + dx);
      overlay.bounds.height = Math.max(MIN_HEIGHT, startHeight + dy);
      this.#applyBounds(overlay);
    }
  };

  #onDocumentMouseUp = (): void => {
    if (this.#dragState) {
      const { overlay } = this.#dragState;
      this.#dragState = null;
      if (overlay.window?.persist) this.#persist(overlay);
    }
    if (this.#resizeState) {
      const { overlay } = this.#resizeState;
      this.#resizeState = null;
      if (overlay.window?.persist) this.#persist(overlay);
    }
  };

  /** Begin dragging an overlay. Called from overlay-header. */
  beginDrag(id: string, clientX: number, clientY: number): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay || !overlay.window?.draggable || overlay.minimized || overlay.maximized) return false;
    const rect = overlay.element.getBoundingClientRect();
    this.#dragState = {
      overlay,
      startX: clientX,
      startY: clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    return true;
  }

  /** Begin resizing an overlay. Called from overlay-header. */
  beginResize(id: string, clientX: number, clientY: number): boolean {
    const overlay = this.#stack.find((open) => open.id === id);
    if (!overlay || !overlay.window?.resizable || overlay.minimized || overlay.maximized) return false;
    const rect = overlay.element.getBoundingClientRect();
    this.#resizeState = {
      overlay,
      startX: clientX,
      startY: clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    return true;
  }

  #applyBounds(overlay: OpenOverlay): void {
    const { x, y, width, height } = overlay.bounds;
    overlay.element.style.left = `${x}px`;
    overlay.element.style.top = `${y}px`;
    overlay.element.style.width = `${width}px`;
    overlay.element.style.height = `${height}px`;
  }

  #persist(overlay: OpenOverlay): void {
    if (!overlay.window?.persist) return;
    this.#bounds[overlay.id] = { ...overlay.bounds };
    saveBounds(this.#bounds);
  }
}

/** Global singleton instance — lazy-initialized on first access. */
let _overlayManager: OverlayManager | undefined;

export const overlayManager = new Proxy({} as OverlayManager, {
  get(_target, prop, receiver) {
    if (!_overlayManager) _overlayManager = new OverlayManager(document);
    return Reflect.get(_overlayManager, prop, receiver);
  },
});

export function getOverlayManager(doc?: Document): OverlayManager {
  if (!_overlayManager) _overlayManager = new OverlayManager(doc);
  return _overlayManager;
}

/** Reset the singleton (for testing). */
export function resetOverlayManager(): void {
  _overlayManager?.dispose();
  _overlayManager = undefined;
}
