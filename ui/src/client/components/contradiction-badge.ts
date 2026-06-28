import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $graphMeta, $graphNodes } from '../core/store.js';

@customElement('contradiction-badge')
export class ContradictionBadge extends LitElement {
  private unsub = $graphNodes.subscribe(() => this.requestUpdate());

  static override styles = css`
    :host { display: inline-flex; align-items: center; }
    .badge { display: flex; align-items: center; gap: 4px; background: rgba(255, 0, 255, 0.1); border: 1px solid rgba(255, 0, 255, 0.3); border-radius: 4px; padding: 2px 6px; font-family: var(--font-data); font-size: 0.65rem; color: #ff00ff; cursor: pointer; }
    .badge:hover { background: rgba(255, 0, 255, 0.2); }
    .pulse { animation: pulse 1s ease-in-out 3; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  `;

  private countContradictions(): number {
    let count = 0;
    for (const [, node] of $graphNodes.get()) {
      if (node.nodeType === 'contradiction' || (node.lensData?.color?.includes('ff00ff'))) count++;
    }
    return count;
  }

  override render() {
    const count = this.countContradictions();
    if (count === 0) return html``;
    return html`
      <div class="badge ${count > 0 ? 'pulse' : ''}" title="${count} contradiction(s) detected">
        <span>⚡</span>
        <span>${count}</span>
      </div>
    `;
  }
}
