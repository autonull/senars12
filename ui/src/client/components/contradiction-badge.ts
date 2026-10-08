import { css, html } from 'lit';
import { state } from 'lit/decorators.js';
import { $graphFilter, $graphNodes, defineSurface, SurfaceComponent } from '../core/index.js';

export class ContradictionBadge extends SurfaceComponent {
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
  @state() private pulsing = false;
  private prevCount = 0;

  protected override surfaceState() {
    return this.countContradictions() === 0 ? 'empty' : 'ready';
  }

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => {
      const count = this.countContradictions();
      if (count > this.prevCount) {
        this.pulsing = true;
        setTimeout(() => {
          this.pulsing = false;
          this.requestUpdate();
        }, 3000);
      }
      this.prevCount = count;
    });
  }

  protected override renderBody() {
    const count = this.countContradictions();
    const filterActive = $graphFilter.get() === 'contradiction';
    return html`
      <div class="badge ${this.pulsing ? 'pulse' : ''} ${filterActive ? 'filter-active' : ''}"
        title="${filterActive ? 'Show all nodes' : `Filter to ${count} contradiction(s)`}"
        @click=${this.handleClick} role="button" tabindex="0">
        <span>⚡</span>
        <span>${count}</span>
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
    $graphFilter.set($graphFilter.get() === 'contradiction' ? null : 'contradiction');
  }
}

defineSurface(
  {
    id: 'contradiction-badge',
    title: 'Contradiction badge',
    tag: 'contradiction-badge',
    bindings: { graphNodes: $graphNodes, graphFilter: $graphFilter },
  },
  ContradictionBadge
);

declare global {
  interface HTMLElementTagNameMap {
    'contradiction-badge': ContradictionBadge;
  }
}