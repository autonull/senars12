/**
 * FocusTrap for overlays/modals. Traps Tab within the container, pierces shadow
 * roots (every overlay is a Lit custom element, so the focusables live inside
 * its shadow root), focuses the first one on activate — retrying on the next
 * frame because Lit renders the content asynchronously — and restores focus to
 * the previously focused element on dispose.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const collectFocusable = (node: ParentNode): HTMLElement[] => {
  const found = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
  for (const host of node.querySelectorAll<HTMLElement>('*')) {
    if (host.shadowRoot) found.push(...collectFocusable(host.shadowRoot));
  }
  return found;
};

const focusables = (container: HTMLElement): HTMLElement[] => {
  const light = collectFocusable(container);
  return container.shadowRoot ? [...collectFocusable(container.shadowRoot), ...light] : light;
};

export class FocusTrap {
  private previousActive: Element | null = null;
  private readonly container: HTMLElement;
  private readonly autoFocus: boolean;
  private handler: ((event: KeyboardEvent) => void) | null = null;
  private frame = 0;

  constructor(container: HTMLElement, autoFocus = true) {
    this.container = container;
    this.previousActive = container.ownerDocument.activeElement;
    this.autoFocus = autoFocus;
  }

  activate() {
    if (!this.autoFocus) {
      this.#trapTab();
      return;
    }
    this.focusFirst();
    this.frame = this.container.ownerDocument.defaultView?.requestAnimationFrame(() =>
      this.focusFirst()
    ) ?? 0;

    this.#trapTab();
  }

  #trapTab() {
    this.handler = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const list = focusables(this.container);
      if (list.length < 2) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (event.shiftKey && this.container.ownerDocument.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && this.container.ownerDocument.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    this.container.ownerDocument.addEventListener('keydown', this.handler);
  }

  private focusFirst() {
    focusables(this.container)[0]?.focus();
  }

  restoreFocus() {
    if (this.handler) this.container.ownerDocument.removeEventListener('keydown', this.handler);
    if (this.previousActive instanceof HTMLElement) this.previousActive.focus();
  }

  dispose() {
    if (this.frame) this.container.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.restoreFocus();
    this.handler = null;
    this.previousActive = null;
  }
}
