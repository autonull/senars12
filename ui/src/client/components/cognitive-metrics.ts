import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $cognitiveMetrics } from '../core/index.js';
import { BaseComponent } from '../core/index.js';
import { TOKEN_COLORS } from '../utils/token-colors.js';

@customElement('cognitive-metrics')
export class CognitiveMetrics extends BaseComponent {
  static override styles = css`
    :host {
      display: block; padding: var(--spacing-scale-2) var(--spacing-scale-3);
      border-top: 1px solid var(--colors-semantic-border-subtle);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
    }
    .cards {
      display: flex; gap: var(--spacing-scale-3); flex-wrap: wrap;
    }
    .card {
      display: flex; flex-direction: column; gap: 1px;
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-scale-md);
      min-width: 80px;
    }
    .card-value {
      font-size: var(--typography-scale-base);
      font-weight: var(--typography-fontWeights-semibold);
      color: var(--colors-semantic-text-primary);
      font-variant-numeric: tabular-nums;
    }
    .card-label {
      font-size: 0.6rem;
      color: var(--colors-semantic-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-indicator {
      width: 100%; height: 2px; margin-top: var(--spacing-scale-1);
      border-radius: 1px; transition: var(--transitions-fast);
    }
    .urgency-list {
      display: flex; gap: var(--spacing-scale-2); margin-top: var(--spacing-scale-1);
    }
    .urgency-item {
      display: flex; align-items: center; gap: var(--spacing-scale-1);
    }
    .urgency-dot {
      width: 6px; height: 6px; border-radius: 50%;
    }
    .urgency-value {
      font-size: 0.6rem;
      color: var(--colors-semantic-text-secondary);
      font-variant-numeric: tabular-nums;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($cognitiveMetrics);
  }

  override render() {
    const m = $cognitiveMetrics.get();
    if (!m) return html``;

    const cards = [
      { label: 'Active Concepts', value: m.activeConcepts, color: TOKEN_COLORS.accentCyan },
      { label: 'Total Concepts', value: m.totalConcepts, color: TOKEN_COLORS.textSecondary },
      { label: 'Derivations/s', value: m.derivationsPerSec.toFixed(1), color: TOKEN_COLORS.accentAmber },
      { label: 'Contradictions', value: m.contradictionCount, color: TOKEN_COLORS.error },
      { label: 'Working Mem', value: m.workingMemorySize, color: TOKEN_COLORS.accentMagenta },
    ];

    return html`
      <div class="cards">
        ${cards.map((c) => html`
          <div class="card">
            <span class="card-label">${c.label}</span>
            <span class="card-value">${c.value}</span>
            <div class="card-indicator" style="background:${c.color}"></div>
          </div>
        `)}
        ${m.goalUrgencyDistribution ? html`
          <div class="card">
            <span class="card-label">Urgency</span>
            <div class="urgency-list">
              ${Object.entries(m.goalUrgencyDistribution).map(([k, v]) => html`
                <div class="urgency-item">
                  <span class="urgency-dot" style="background:${k === 'high' ? TOKEN_COLORS.error : k === 'medium' ? TOKEN_COLORS.accentAmber : TOKEN_COLORS.success}"></span>
                  <span class="urgency-value">${v}</span>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'cognitive-metrics': CognitiveMetrics; } }
