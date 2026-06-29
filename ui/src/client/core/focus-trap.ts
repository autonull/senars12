/**
 * FocusTrap utility for drawers/modals.
 * Restores focus to the previously focused element when disposed.
 */
export class FocusTrap {
  private previousActive: Element | null = null;
  private container: HTMLElement;
  private focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  private handler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.previousActive = document.activeElement;
  }

  activate() {
    const focusable = Array.from(this.container.querySelectorAll<HTMLElement>(this.focusableSelector));
    focusable[0]?.focus();

    this.handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (focusable.length < 2) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', this.handler);
  }

  restoreFocus() {
    if (this.handler) document.removeEventListener('keydown', this.handler);
    if (this.previousActive instanceof HTMLElement) {
      this.previousActive.focus();
    }
  }

  dispose() {
    this.restoreFocus();
    this.handler = null;
    this.previousActive = null;
  }
}
