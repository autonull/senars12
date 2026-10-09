/**
 * Shared overlay header component (§4.5).
 * Replaces duplicated header markup across overlays; adds drag-handle +
 * resize grip opt-in via `data-draggable` / `data-resizable` on host.
 */

import { css, html, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { getOverlayManager } from '../../core/overlay-manager.js';

export interface OverlayHeaderEvents {
  'header-close': { id: string };
  'header-pin': { id: string; pinned: boolean };
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
  `;

  @property({ type: String, attribute: 'overlay-id' }) overlayId = '';
  @property({ type: String }) kind = '';
  @property({ type: String }) title = '';
  @property({ type: Boolean, attribute: 'draggable' }) draggable = false;
  @property({ type: Boolean, attribute: 'resizable' }) resizable = false;
  @property({ type: Boolean, attribute: 'pinnable' }) pinnable = true;
  @property({ type: Boolean, attribute: 'closeable' }) closeable = true;

  @state() private pinned = false;
  @state() private dragging = false;
  @state() private resizing = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private elementStartX = 0;
  private elementStartY = 0;
  private elementStartWidth = 0;
  private elementStartHeight = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.updatePinnedState();
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
  }

  override updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (changedProperties.has('overlayId')) {
      this.updatePinnedState();
    }
  }

  private updatePinnedState(): void {
    if (this.overlayId) {
      const manager = getOverlayManager();
      this.pinned = manager.pinned().includes(this.overlayId);
    }
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
              ⋮⋮
            </button>
          `
        : ''}
      ${this.kind ? html`<span class="kind">${this.kind}</span>` : ''}
      <span class="title">${this.title || this.overlayId}</span>
      <div class="actions">
        ${this.pinnable
          ? html`
              <button
                class="action-btn"
                aria-label=${this.pinned ? 'Unpin' : 'Pin'}
                aria-pressed=${this.pinned}
                @click=${this.onTogglePin}
              >
                📌
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
                ×
              </button>
            `
          : ''}
        ${this.resizable ? html`<div class="resize-grip" @mousedown=${this.onResizeStart} aria-label="Resize" role="slider" aria-orientation="horizontal"></div>` : ''}
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

  private onClose = (): void => {
    this.emit('header-close', { id: this.overlayId });
  };

  private onDragStart = (event: MouseEvent): void => {
    if (!this.draggable) return;
    event.preventDefault();
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    const overlay = document.getElementById(this.overlayId)?.closest('[data-surface]');
    if (overlay) {
      const rect = overlay.getBoundingClientRect();
      this.elementStartX = rect.left;
      this.elementStartY = rect.top;
    }
    this.emit('header-drag-start', { id: this.overlayId, clientX: event.clientX, clientY: event.clientY });
    this.requestUpdate();
  };

  private onResizeStart = (event: MouseEvent): void => {
    if (!this.resizable) return;
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    const overlay = document.getElementById(this.overlayId)?.closest('[data-surface]');
    if (overlay) {
      const rect = overlay.getBoundingClientRect();
      this.elementStartWidth = rect.width;
      this.elementStartHeight = rect.height;
    }
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
    'header-drag-start': CustomEvent<OverlayHeaderEvents['header-drag-start']>;
    'header-drag-move': CustomEvent<OverlayHeaderEvents['header-drag-move']>;
    'header-drag-end': CustomEvent<OverlayHeaderEvents['header-drag-end']>;
    'header-resize-start': CustomEvent<OverlayHeaderEvents['header-resize-start']>;
    'header-resize-move': CustomEvent<OverlayHeaderEvents['header-resize-move']>;
    'header-resize-end': CustomEvent<OverlayHeaderEvents['header-resize-end']>;
  }
}