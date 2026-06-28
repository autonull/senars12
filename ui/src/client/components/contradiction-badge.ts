import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $graphNodes } from '../core/store.js';
import { BaseComponent } from '../core/base-component.js';

@customElement('contradiction-badge')
export class ContradictionBadge extends BaseComponent {
  @state() private count = 0;
  @state() private pulsing = false;
  private prevCount = 0;

  static override styles = css`
    :host { display: inline-flex; align-items: center; }
    .badge { display: flex; align-items: center; gap: 4px; background: rgba(255, 0, 255, 0.1); border: 1px solid rgba(255, 0, 255, 0.3); border-radius: 4px; padding: 2px 6px; font-family: var(--font-data); font-size: 0.65rem; color: #ff00ff; cursor: pointer; transition: background 0.2s; }
    .badge:hover { background: rgba(255, 0, 255, 0.2); }
    .badge.pulse { animation: pulse 1s ease-in-out 3; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => {
      this.count = this.countContradictions();
      if (this.count > this.prevCount) {
        this.pulsing = true;
        setTimeout(() => { this.pulsing = false; this.requestUpdate(); }, 3000);
      }
      this.prevCount = this.count;
      this.requestUpdate();
    });
  }

  private countContradictions(): number {
    let count = 0;
    for (const [, node] of $graphNodes.get()) {
      if ((node.nodeType as string) === 'contradiction' || (node.lensData?.color?.includes('ff00ff'))) count++;
    }
    return count;
  }

  override render() {
    if (this.count === 0) return html``;
    return html`
      <div class="badge ${this.pulsing ? 'pulse' : ''}" title="${this.count} contradiction(s) detected">
        <span>⚡</span>
        <span>${this.count}</span>
      </div>
    `;
  }
}
