/**
 * Shared overlay header component (§4.5).
 * Replaces duplicated header markup across overlays; adds drag-handle +
 * resize grip opt-in via `data-draggable` / `data-resizable` on host.
 * Window controls: minimize, maximize (§overlay-windows).
 */

import { css, html, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { getOverlayManager } from '../../core/overlay-manager.js';
import { overlayDescriptor } from '../../core/overlay-registry.js';

export interface OverlayHeaderEvents {
  'header-close': { id: string };
  'header-pin': { id: string; pinned: boolean };
  'header-minimize': { id: string; minimized: boolean };
  'header-maximize': { id: string; maximized: boolean };
  'header-drag-start': { id: string; clientX: number; clientY: number };
  'header-drag-move': { id: string; clientX: number; clientY: number };
  'header-drag-end': { id: string };
  'header-resize-start': { id: string; clientX: number; clientY: number };
  'header-resize-move': { id: string; clientX: number; clientY: number };
  'header-resize-end': { id: string };
}

type OverlayHeaderEventType = keyof OverlayHeaderEvents;
type OverlayHeaderEventDetail<T extends OverlayHeaderEventType> = OverlayHeaderEvents[T];

@customElement('overlay-header')
export class OverlayHeader extends BaseComponent {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-panel);
      user-select: none;
      -webkit-user-select: none;
    }
    .drag-handle {
      cursor: grab;
      color: var(--colors-semantic-text-muted);
      padding: var(--spacing-scale-1);
      border-radius: var(--borderRadius-scale-sm);
      transition: var(--transitions-fast);
      flex-shrink: 0;
    }
    .drag-handle:hover {
      color: var(--colors-semantic-accent-primary);
      background: var(--colors-semantic-bg-subtle);
    }
    .drag-handle.dragging {
      cursor: grabbing;
      color: var(--colors-semantic-accent-primary);
      background: var(--colors-semantic-accent-subtle);
    }
    .kind {
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-muted);
      flex-shrink: 0;
    }
    .title {
      flex: 1;
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
      font-weight: var(--typography-fontWeights-semibold);
      color: var(--colors-semantic-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .crumbs {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-1);
      overflow: hidden;
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
      white-space: nowrap;
    }
    .crumb {
      border: none;
      background: transparent;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      padding: 0;
      font: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      transition: var(--transitions-fast);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .crumb:hover {
      color: var(--colors-semantic-accent-primary);
    }
    .crumb.current {
      color: var(--colors-semantic-text-primary);
      font-weight: var(--typography-fontWeights-semibold);
      text-decoration: none;
      cursor: default;
    }
    .sep {
      color: var(--colors-semantic-text-muted);
      flex-shrink: 0;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-1);
      flex-shrink: 0;
    }
    .action-btn {
      border: none;
      background: transparent;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      font-size: var(--typography-scale-sm);
      padding: var(--spacing-scale-1);
      border-radius: var(--borderRadius-scale-sm);
      transition: var(--transitions-fast);
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .action-btn:hover {
      color: var(--colors-semantic-accent-primary);
      background: var(--colors-semantic-bg-subtle);
    }
    .action-btn[aria-pressed="true"] {
      color: var(--colors-semantic-accent-primary);
      background: var(--colors-semantic-accent-subtle);
    }
    .resize-grip {
      width: 16px;
      height: 16px;
      cursor: se-resize;
      position: relative;
      flex-shrink: 0;
    }
    .resize-grip::after {
      content: '';
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 10px;
      height: 10px;
      border-right: 2px solid var(--colors-semantic-border-subtle);
      border-bottom: 2px solid var(--colors-semantic-border-subtle);
      border-radius: 0 0 2px 0;
    }
    .resize-grip:hover::after {
      border-color: var(--colors-semantic-accent-primary);
    }
    :host([data-minimized]) .title,
    :host([data-minimized]) .kind,
    :host([data-minimized]) .resize-grip {
      display: none;
    }
    :host([data-minimized]) .drag-handle {
      cursor: grab;
    }
  `;

  @property({ type: String, attribute: 'overlay-id' }) overlayId = '';
  @property({ type: String }) kind = '';
  @property({ type: String }) override title = '';
  @property({ type: Boolean, attribute: 'draggable' }) override draggable = false;
  @property({ type: Boolean, attribute: 'resizable' }) resizable = false;
  @property({ type: Boolean, attribute: 'pinnable' }) pinnable = true;
  @property({ type: Boolean, attribute: 'closeable' }) closeable = true;
  @property({ type: Boolean, attribute: 'minimizable' }) minimizable = false;
  @property({ type: Boolean, attribute: 'maximizable' }) maximizable = false;

  @state() private pinned = false;
  @state() private minimized = false;
  @state() private maximized = false;
  @state() private dragging = false;
  @state() private resizing = false;
  @state() private crumbs: { id: string; title: string }[] = [];
  private unsubscribeStack?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.updatePinnedState();
    this.updateWindowState();
    this.updateCrumbs();
    this.unsubscribeStack = getOverlayManager().subscribe(() => this.updateCrumbs());
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
  }

  override disconnectedCallback(): void {
    this.unsubscribeStack?.();
    this.unsubscribeStack = undefined;
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
  }

  override updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (changedProperties.has('overlayId')) {
      this.updatePinnedState();
      this.updateWindowState();
      this.updateCrumbs();
    }
  }

  /**
   * The drill-down trail from the bottom of the stack to this overlay. A single
   * overlay has no trail (nothing to go back to), so it renders its title instead.
   */
  private updateCrumbs(): void {
    const stack = getOverlayManager().stack();
    const index = this.overlayId ? stack.indexOf(this.overlayId) : -1;
    this.crumbs =
      index > 0
        ? stack.slice(0, index + 1).map((id) => ({ id, title: overlayDescriptor(id)?.title ?? id }))
        : [];
  }

  private updatePinnedState(): void {
    if (this.overlayId) {
      const manager = getOverlayManager();
      this.pinned = manager.pinned().includes(this.overlayId);
    }
  }

  private updateWindowState(): void {
    if (this.overlayId) {
      const manager = getOverlayManager();
      const bounds = manager.getBounds(this.overlayId);
      if (bounds) {
        // We can't directly get minimized/maximized state from manager,
        // so we'll rely on the host element's attributes
        const host = this.getHostElement();
        if (host) {
          this.minimized = host.hasAttribute('data-minimized');
          this.maximized = host.hasAttribute('data-maximized');
        }
      }
    }
  }

  private getHostElement(): HTMLElement | null {
    if (!this.overlayId) return null;
    const element = document.getElementById(this.overlayId);
    return element?.closest('[data-surface]') as HTMLElement | null;
  }

  protected override render() {
    return html`
      ${this.draggable
        ? html`
            <button
              class="drag-handle ${this.dragging ? 'dragging' : ''}"
              aria-label="Drag to reposition"
              aria-grabbed=${this.dragging}
              @mousedown=${this.onDragStart}
              tabindex="-1"
            >
              <s-icon name="more" size="14"></s-icon>
            </button>
          `
        : ''}
      ${this.kind ? html`<span class="kind">${this.kind}</span>` : ''}
      ${this.crumbs.length > 1
        ? html`<nav class="crumbs" aria-label="Overlay path">
            ${this.crumbs.map(
              (crumb, index) => html`
                ${index > 0 ? html`<span class="sep" aria-hidden="true">›</span>` : ''}
                ${index === this.crumbs.length - 1
                  ? html`<span class="crumb current" aria-current="page">${crumb.title}</span>`
                  : html`<button class="crumb" @click=${() => this.onCrumb(crumb.id)}>
                      ${crumb.title}
                    </button>`}
              `
            )}
          </nav>`
        : html`<span class="title">${this.title || this.overlayId}</span>`}
      <div class="actions">
        ${this.minimizable
          ? html`
              <button
                class="action-btn"
                aria-label=${this.minimized ? 'Restore' : 'Minimize'}
                aria-pressed=${this.minimized}
                @click=${this.onToggleMinimize}
                ?disabled=${this.maximized}
              >
                <s-icon name=${this.minimized ? 'maximize' : 'minimize'} size="14"></s-icon>
              </button>
            `
          : ''}
        ${this.maximizable
          ? html`
              <button
                class="action-btn"
                aria-label=${this.maximized ? 'Restore' : 'Maximize'}
                aria-pressed=${this.maximized}
                @click=${this.onToggleMaximize}
                ?disabled=${this.minimized}
              >
                <s-icon name=${this.maximized ? 'minimize' : 'maximize'} size="14"></s-icon>
              </button>
            `
          : ''}
        ${this.pinnable
          ? html`
              <button
                class="action-btn"
                aria-label=${this.pinned ? 'Unpin' : 'Pin'}
                aria-pressed=${this.pinned}
                @click=${this.onTogglePin}
              >
                <s-icon name="pin" size="14"></s-icon>
              </button>
            `
          : ''}
        ${this.closeable
          ? html`
              <button
                class="action-btn close"
                aria-label="Close"
                @click=${this.onClose}
              >
                <s-icon name="closeX" size="14"></s-icon>
              </button>
            `
          : ''}
        ${this.resizable
            ? html`
                <div
                  class="resize-grip"
                  @mousedown=${this.onResizeStart}
                  aria-label="Resize"
                  role="slider"
                  aria-orientation="horizontal"
                ></div>
              `
            : ''}
      </div>
    `;
  }

  private emit<T extends OverlayHeaderEventType>(type: T, detail: OverlayHeaderEventDetail<T>): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private onTogglePin = (): void => {
    const newPinned = !this.pinned;
    this.pinned = newPinned;
    if (this.overlayId) {
      const manager = getOverlayManager();
      manager.setPinned(this.overlayId, newPinned);
    }
    this.emit('header-pin', { id: this.overlayId, pinned: newPinned });
  };

  private onToggleMinimize = (): void => {
    if (!this.overlayId) return;
    const manager = getOverlayManager();
    const newMinimized = !this.minimized;
    const success = newMinimized ? manager.minimize(this.overlayId) : manager.restore(this.overlayId);
    if (success) {
      this.minimized = newMinimized;
      const host = this.getHostElement();
      host?.toggleAttribute('data-minimized', newMinimized);
      this.emit('header-minimize', { id: this.overlayId, minimized: newMinimized });
    }
  };

  private onToggleMaximize = (): void => {
    if (!this.overlayId) return;
    const manager = getOverlayManager();
    const newMaximized = !this.maximized;
    const success = newMaximized ? manager.maximize(this.overlayId) : manager.unmaximize(this.overlayId);
    if (success) {
      this.maximized = newMaximized;
      const host = this.getHostElement();
      host?.toggleAttribute('data-maximized', newMaximized);
      this.emit('header-maximize', { id: this.overlayId, maximized: newMaximized });
    }
  };

  private onClose = (): void => {
    this.emit('header-close', { id: this.overlayId });
  };

  /** Clicking a crumb closes every overlay above it, returning focus to that level. */
  private onCrumb = (id: string): void => {
    const manager = getOverlayManager();
    const stack = manager.stack();
    const index = stack.indexOf(id);
    if (index < 0) return;
    for (const above of stack.slice(index + 1).reverse()) manager.close(above);
  };

  private onDragStart = (event: MouseEvent): void => {
    if (!this.draggable || !this.overlayId) return;
    event.preventDefault();
    const manager = getOverlayManager();
    const started = manager.beginDrag(this.overlayId, event.clientX, event.clientY);
    if (!started) return;
    this.dragging = true;
    this.emit('header-drag-start', { id: this.overlayId, clientX: event.clientX, clientY: event.clientY });
    this.requestUpdate();
  };

  private onResizeStart = (event: MouseEvent): void => {
    if (!this.resizable || !this.overlayId) return;
    event.preventDefault();
    event.stopPropagation();
    const manager = getOverlayManager();
    const started = manager.beginResize(this.overlayId, event.clientX, event.clientY);
    if (!started) return;
    this.resizing = true;
    this.emit('header-resize-start', { id: this.overlayId, clientX: event.clientX, clientY: event.clientY });
  };

  private onDocumentMouseMove = (event: MouseEvent): void => {
    if (this.dragging) {
      this.emit('header-drag-move', { id: this.overlayId, clientX: event.clientX, clientY: event.clientY });
    }
    if (this.resizing) {
      this.emit('header-resize-move', { id: this.overlayId, clientX: event.clientX, clientY: event.clientY });
    }
  };

  private onDocumentMouseUp = (): void => {
    if (this.dragging) {
      this.dragging = false;
      this.emit('header-drag-end', { id: this.overlayId });
      this.requestUpdate();
    }
    if (this.resizing) {
      this.resizing = false;
      this.emit('header-resize-end', { id: this.overlayId });
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'overlay-header': OverlayHeader;
  }
  interface HTMLElementEventMap {
    'header-close': CustomEvent<OverlayHeaderEvents['header-close']>;
    'header-pin': CustomEvent<OverlayHeaderEvents['header-pin']>;
    'header-minimize': CustomEvent<OverlayHeaderEvents['header-minimize']>;
    'header-maximize': CustomEvent<OverlayHeaderEvents['header-maximize']>;
    'header-drag-start': CustomEvent<OverlayHeaderEvents['header-drag-start']>;
    'header-drag-move': CustomEvent<OverlayHeaderEvents['header-drag-move']>;
    'header-drag-end': CustomEvent<OverlayHeaderEvents['header-drag-end']>;
    'header-resize-start': CustomEvent<OverlayHeaderEvents['header-resize-start']>;
    'header-resize-move': CustomEvent<OverlayHeaderEvents['header-resize-move']>;
    'header-resize-end': CustomEvent<OverlayHeaderEvents['header-resize-end']>;
  }
}