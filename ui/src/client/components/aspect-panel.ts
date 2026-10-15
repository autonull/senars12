/**
 * Aspect panel — re-homes UI.17's aspects as a single panel driven by
 * `$focus` + `$aspect` + `resolveFocus`. The panel projects the current
 * focus's provenance, history, origin, or ambient slice; `content` and
 * `neighborhood` render in the graph viewport.
 */

import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { $workspaceGraph, BaseComponent } from '../core/index.js';
import { type FocusRef, type Aspect, ASPECTS, DEFAULT_ASPECT, focus, ASPECT_LABELS, ASPECT_ICONS } from '../framework/coordinates.js';
import { resolveFocus, type FocusResolution } from '../framework/resolver.js';
import { defineSurface, SurfaceComponent } from '../core/surface.js';
import { Capability } from '../core/capabilities.js';
import { type SemanticBlock } from '../core/workspace-graph.js';
import { SIcon } from './primitives/index.js';

@customElement('s-aspect-panel')
export class SAspectPanel extends SurfaceComponent {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-panel);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-elevated);
    }
    .aspect-selector {
      display: flex;
      gap: var(--spacing-scale-1);
      flex-wrap: wrap;
      flex: 1;
    }
    .aspect-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-scale-1);
      padding: var(--spacing-scale-1) var(--spacing-scale-2);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-button);
      background: transparent;
      color: var(--colors-semantic-text-secondary);
      cursor: pointer;
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs);
      text-transform: capitalize;
      transition: var(--transitions-fast);
    }
    .aspect-btn:hover {
      border-color: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-accent-primary);
    }
    .aspect-btn.active {
      background: var(--colors-semantic-accent-subtle);
      border-color: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-accent-primary);
    }
    .focus-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-muted);
      font-family: var(--typography-fontFamilies-data);
    }
    .content {
      flex: 1;
      overflow: auto;
      padding: var(--spacing-scale-3);
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 200px;
      color: var(--colors-semantic-text-muted);
      text-align: center;
      gap: var(--spacing-scale-2);
    }
    .empty-state s-icon {
      font-size: 48px;
      opacity: 0.5;
    }
    .slice-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      margin-bottom: var(--spacing-scale-3);
      padding-bottom: var(--spacing-scale-2);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
    }
    .slice-title {
      font-weight: var(--typography-fontWeights-semibold);
      font-size: var(--typography-scale-sm);
    }
    .slice-count {
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-muted);
      background: var(--colors-semantic-bg-base);
      padding: 1px var(--spacing-scale-2);
      border-radius: var(--borderRadius-component-input);
    }
    .provenance-list,
    .history-list,
    .trace-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-2);
    }
    .provenance-item,
    .history-item,
    .trace-item {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-1);
      padding: var(--spacing-scale-2);
      background: var(--colors-semantic-bg-base);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-panel);
    }
    .item-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      font-size: var(--typography-scale-xs);
    }
    .item-kind {
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--colors-semantic-text-muted);
    }
    .item-title {
      font-weight: 500;
      color: var(--colors-semantic-text-primary);
      flex: 1;
    }
    .item-meta {
      color: var(--colors-semantic-text-muted);
      font-family: var(--typography-fontFamilies-data);
    }
    .item-details {
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-secondary);
      padding-left: var(--spacing-scale-3);
      border-left: 1px solid var(--colors-semantic-border-subtle);
    }
    .origin-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 200px;
      color: var(--colors-semantic-text-muted);
      text-align: center;
      gap: var(--spacing-scale-3);
    }
    .origin-empty s-icon {
      font-size: 64px;
      opacity: 0.3;
    }
    .origin-empty p {
      max-width: 400px;
      line-height: 1.6;
    }
    .ambient-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-1);
    }
    .ambient-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-1) var(--spacing-scale-2);
      background: var(--colors-semantic-bg-base);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-input);
      font-size: var(--typography-scale-xs);
    }
    .ambient-item s-icon {
      color: var(--colors-semantic-accent-cyan);
    }
    .ambient-priority {
      font-family: var(--typography-fontFamilies-data);
      color: var(--colors-semantic-text-muted);
    }
  `;

  @property({ type: Object }) focusRef!: FocusRef;
  @property({ type: String }) aspect: Aspect = DEFAULT_ASPECT;

  @state() private resolution: FocusResolution | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
  }

  protected override updated(): void {
    this.refresh();
  }

  private refresh(): void {
    if (!this.focusRef) return;
    const graph = $workspaceGraph.get();
    const depth = this.aspect === 'neighborhood' ? 2 : 1;
    this.resolution = resolveFocus(this.focusRef, { graph, depth });
  }

  protected override renderBody(): TemplateResult {
    if (!this.focusRef || this.focusRef.kind === 'mind') {
      return this.renderEmptyState('mind', 'Select a focus to inspect its aspects');
    }

    if (!this.resolution) {
      return this.renderEmptyState('search', 'Resolving focus…');
    }

    const aspectContent = this.renderAspect(this.aspect);
    if (!aspectContent) {
      return this.renderEmptyState(ASPECT_ICONS[this.aspect], `No ${ASPECT_LABELS[this.aspect].toLowerCase()} data for this focus`);
    }

    return html`
      <div class="header">
        <div class="aspect-selector" role="group" aria-label="Select aspect">
          ${ASPECTS.map(a => html`
            <button
              class="aspect-btn ${this.aspect === a ? 'active' : ''}"
              @click=${() => this.dispatchEvent(new CustomEvent('aspect-change', { detail: { aspect: a }, bubbles: true, composed: true }))}
              aria-pressed=${this.aspect === a}
            >
              <s-icon name=${ASPECT_ICONS[a]} size="14"></s-icon>
              ${ASPECT_LABELS[a]}
            </button>
          `)}
        </div>
        <div class="focus-info">
          ${this.renderFocusBadge()}
        </div>
      </div>
      <div class="content">
        ${aspectContent}
      </div>
    `;
  }

  private renderFocusBadge(): TemplateResult | typeof nothing {
    if (!this.focusRef) return nothing;
    const key = this.focusRef.kind === 'mind' ? 'mind' : `${this.focusRef.kind}:${this.focusRefId()}`;
    return html`
      <span class="focus-kind" style="text-transform: capitalize;">${this.focusRef.kind}</span>
      <span class="focus-id">${this.focusRefId() ?? '—'}</span>
    `;
  }

  private focusRefId(): string | undefined {
    if (!this.focusRef) return undefined;
    switch (this.focusRef.kind) {
      case 'concept':
      case 'task':
      case 'goal':
        return (this.focusRef as any).term;
      case 'derivation':
      case 'proposal':
      case 'judgment':
      case 'turn':
      case 'event':
      case 'cycle':
        return (this.focusRef as any).id;
      case 'step':
        return (this.focusRef as any).derivationId;
      case 'trace':
        return (this.focusRef as any).correlationId;
      case 'time':
        return `time:${(this.focusRef as any).time?.kind ?? 'live'}`;
      case 'drive':
        return (this.focusRef as any).name;
      case 'space':
        return (this.focusRef as any).id;
      case 'mind':
        return 'mind';
      default:
        return undefined;
    }
  }

  private renderAspect(aspect: Aspect): TemplateResult | typeof nothing {
    switch (aspect) {
      case 'provenance':
        return this.renderProvenance();
      case 'history':
        return this.renderHistory();
      case 'origin':
        return this.renderOrigin();
      case 'ambient':
        return this.renderAmbient();
      default:
        return nothing;
    }
  }

  private renderProvenance(): TemplateResult | typeof nothing {
    const prov = this.resolution!.provenance;
    if (!prov?.records.length) return nothing;

    return html`
      <div class="slice-header">
        <s-icon name=${ASPECT_ICONS.provenance} size="16"></s-icon>
        <span class="slice-title">Provenance</span>
        <span class="slice-count">${prov.records.length} record${prov.records.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="provenance-list">
        ${prov.records.map(block => this.renderProvenanceItem(block))}
      </div>
    `;
  }

  private renderProvenanceItem(block: SemanticBlock): TemplateResult {
    return html`
      <div class="provenance-item">
        <div class="item-header">
          <s-icon name=${this.iconForBlockKind(block.kind)} size="12"></s-icon>
          <span class="item-kind">${block.kind}</span>
          <span class="item-title">${block.title ?? block.id}</span>
          <span class="item-meta">${new Date(block.createdAt).toLocaleTimeString()}</span>
        </div>
        ${block.text ? html`<div class="item-details">${block.text.slice(0, 200)}${block.text.length > 200 ? '…' : ''}</div>` : nothing}
        ${block.uncertainty ? html`<div class="item-details">Truth: f=${block.uncertainty.frequency.toFixed(2)}, c=${block.uncertainty.confidence.toFixed(2)}</div>` : nothing}
      </div>
    `;
  }

  private renderHistory(): TemplateResult | typeof nothing {
    const hist = this.resolution!.history;
    if (!hist?.revisions.length) return nothing;

    return html`
      <div class="slice-header">
        <s-icon name=${ASPECT_ICONS.history} size="16"></s-icon>
        <span class="slice-title">History</span>
        <span class="slice-count">${hist.revisions.length} revision${hist.revisions.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="history-list">
        ${hist.revisions.map(block => this.renderHistoryItem(block))}
      </div>
    `;
  }

  private renderHistoryItem(block: SemanticBlock): TemplateResult {
    return html`
      <div class="history-item">
        <div class="item-header">
          <s-icon name=${this.iconForBlockKind(block.kind)} size="12"></s-icon>
          <span class="item-kind">${block.kind}</span>
          <span class="item-title">${block.title ?? block.id}</span>
          <span class="item-meta">${new Date(block.createdAt).toLocaleTimeString()}</span>
        </div>
        ${block.uncertainty ? html`<div class="item-details">Truth: f=${block.uncertainty.frequency.toFixed(2)}, c=${block.uncertainty.confidence.toFixed(2)}</div>` : nothing}
      </div>
    `;
  }

  private renderOrigin(): TemplateResult | typeof nothing {
    // Origin aspect — requires Judgment Manifold source (UI.18 §19.3 task 6)
    // For now, render empty state declaring the gap
    return html`
      <div class="origin-empty">
        <s-icon name=${ASPECT_ICONS.origin}></s-icon>
        <p>
          <strong>Origin</strong> requires a Judgment Manifold source to render the epistemic split
          between proposed and derived blocks. This surface is declared in the contract
          (<code>ASPECT_SURFACES.origin === undefined</code>) so the gap is visible.
        </p>
        <p style="font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted);">
          When a manifold is available, this panel will show the judgment gate's
          admit/refuse decision and the evidence that drove it.
        </p>
      </div>
    `;
  }

  private renderAmbient(): TemplateResult | typeof nothing {
    // For ambient, we show the ambient layer's sampled foci
    // This is a simplified view — the full ambient layer is in the graph background
    const ambientFoci: Array<{ focus: FocusRef; priority: number }> = [];
    
    // Sample from the attention field would be ideal, but for now show a placeholder
    return html`
      <div class="slice-header">
        <s-icon name=${ASPECT_ICONS.ambient} size="16"></s-icon>
        <span class="slice-title">Ambient</span>
        <span class="slice-count">Background field</span>
      </div>
      <div class="ambient-list">
        <div class="ambient-item">
          <s-icon name="radio" size="14"></s-icon>
          <span>The ambient layer renders as glyphs in the graph background (<code>s-ambient-layer</code>).</span>
        </div>
        <div class="ambient-item">
          <s-icon name="radio" size="14"></s-icon>
          <span>It samples low-attention foci proportionally to their residual weight.</span>
        </div>
        <div class="ambient-item">
          <s-icon name="radio" size="14"></s-icon>
          <span>Open the <strong>Event Log</strong> overlay for the cognitive event stream.</span>
        </div>
      </div>
    `;
  }

  private renderTrace(): TemplateResult | typeof nothing {
    const trace = this.resolution!.trace;
    if (!trace?.events.length) return nothing;

    return html`
      <div class="slice-header">
        <s-icon name=${ASPECT_ICONS.ambient} size="16"></s-icon>
        <span class="slice-title">Trace</span>
        <span class="slice-count">${trace.events.length} event${trace.events.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="trace-list">
        ${trace.events.slice(0, 20).map(block => this.renderTraceItem(block))}
      </div>
      ${trace.events.length > 20 ? html`
        <div class="ambient-item" style="justify-content: center; color: var(--colors-semantic-text-muted);">
          … and ${trace.events.length - 20} more events. Open <strong>Trace Viewer</strong> for full timeline.
        </div>
      ` : nothing}
    `;
  }

  private renderTraceItem(block: SemanticBlock): TemplateResult {
    return html`
      <div class="trace-item">
        <div class="item-header">
          <s-icon name=${this.iconForBlockKind(block.kind)} size="12"></s-icon>
          <span class="item-kind">${block.kind}</span>
          <span class="item-title">${block.title ?? block.text?.slice(0, 50) ?? block.id}</span>
          <span class="item-meta">${new Date(block.createdAt).toLocaleTimeString()}</span>
        </div>
        ${block.uncertainty ? html`<div class="item-details">Truth: f=${block.uncertainty.frequency.toFixed(2)}, c=${block.uncertainty.confidence.toFixed(2)}</div>` : nothing}
      </div>
    `;
  }

  private renderEmptyState(icon: string, message: string): TemplateResult {
    return html`
      <div class="content">
        <div class="empty-state">
          <s-icon name=${icon}></s-icon>
          <p>${message}</p>
        </div>
      </div>
    `;
  }

  private iconForBlockKind(kind: string): string {
    switch (kind) {
      case 'turn': return 'play';
      case 'claim': return 'circle';
      case 'goal': return 'chart';
      case 'question': return 'help';
      case 'answer': return 'check';
      case 'derivation': return 'tool';
      case 'derivation-record': return 'minus';
      case 'gate-decision': return 'lightning';
      case 'config-change': return 'settings';
      case 'command': return 'play';
      case 'error': return 'warningTriangle';
      case 'budget': return 'history';
      default: return 'circle';
    }
  }
}

const ASPECT_PANEL_SURFACE = {
  id: 'aspect-panel',
  title: 'Aspect Panel',
  group: 'panel',
  a11y: { role: 'region' },
} as const;

defineSurface(
  {
    ...ASPECT_PANEL_SURFACE,
    capability: 'reasoning' as Capability,
    placement: 'panel' as const,
  },
  SAspectPanel
);

declare global {
  interface HTMLElementTagNameMap {
    's-aspect-panel': SAspectPanel;
  }
  interface HTMLElementEventMap {
    'aspect-change': CustomEvent<{ aspect: Aspect }>;
  }
}