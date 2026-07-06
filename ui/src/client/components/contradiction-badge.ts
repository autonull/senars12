import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $graphFilter, $graphNodes, BaseComponent } from '../core/index.js';

@customElement('contradiction-badge')
export class ContradictionBadge extends BaseComponent {
  static override styles = css`
    :host { display: inline-flex; align-items: center; }
    .badge {
      display: flex; align-items: center; gap: 4px;
      background: var(--colors-cognitiveLens-contradiction-bg);
      border: 1px solid var(--colors-cognitiveLens-contradiction-primary);
      border-radius: var(--borderRadius-component-input); padding: 2px 6px;
      font-family: var(--typography-fontFamilies-data); font-size: 0.65rem;
      color: var(--colors-cognitiveLens-contradiction-primary);
      cursor: pointer; transition: background var(--transitions-fast), box-shadow var(--transitions-fast);
    }
    .badge:hover { background: var(--colors-cognitiveLens-contradiction-subtle); }
    .badge.filter-active {
      background: var(--colors-cognitiveLens-contradiction-primary);
      color: var(--colors-semantic-text-on-accent);
      box-shadow: 0 0 8px var(--colors-cognitiveLens-contradiction-primary);
    }
    .badge.pulse { animation: pulse 1s ease-in-out 3; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  `;
  @state() private count = 0;
  @state() private pulsing = false;
  @state() private filterActive = false;
  private prevCount = 0;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => {
      this.count = this.countContradictions();
      if (this.count > this.prevCount) {
        this.pulsing = true;
        setTimeout(() => {
          this.pulsing = false;
          this.requestUpdate();
        }, 3000);
      }
      this.prevCount = this.count;
      this.requestUpdate();
    });
    this.watchWith($graphFilter, (filter) => {
      this.filterActive = filter === 'contradiction';
    });
  }

  override render() {
    if (this.count === 0) return html``;
    return html`
      <div class="badge ${this.pulsing ? 'pulse' : ''} ${this.filterActive ? 'filter-active' : ''}"
        title="${this.filterActive ? 'Show all nodes' : `Filter to ${this.count} contradiction(s)`}"
        @click=${this.handleClick} role="button" tabindex="0">
        <span>⚡</span>
        <span>${this.count}</span>
      </div>
    `;
  }

  private countContradictions(): number {
    let count = 0;
    for (const n of $graphNodes.get().values()) {
      if (n.isContradiction) count++;
    }
    return count;
  }

  private handleClick() {
    if (this.filterActive) {
      $graphFilter.set(null);
    } else {
      $graphFilter.set('contradiction');
    }
  }
}
