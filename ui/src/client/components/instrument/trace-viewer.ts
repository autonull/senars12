/**
 * Trace viewer — renders a trace focus (correlationId) as a timeline of events
 * with gate decisions, tool calls, and derivations (§18.1).
 */

import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { $workspaceGraph } from '../../core/store.js';
import { type FocusRef, focus, type SemanticBlock } from '../../framework/index.js';
import { resolveFocus } from '../../framework/resolver.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import '../primitives/icon.js';

@customElement('s-trace-viewer')
export class STraceViewer extends SurfaceComponent {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--fonts-mono);
      font-size: var(--text-sm);
    }
    .trace-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--colors-surface-elevated);
      border: 1px solid var(--colors-border);
      border-radius: var(--radii-md) var(--radii-md) 0 0;
    }
    .trace-correlation-id {
      font-family: var(--fonts-mono);
      font-size: var(--text-xs);
      color: var(--colors-text-muted);
      background: var(--colors-surface);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radii-sm);
    }
    .trace-summary {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      color: var(--colors-text-secondary);
      font-size: var(--text-xs);
    }
    .trace-timeline {
      border-left: 1px solid var(--colors-border);
      padding: var(--space-3);
    }
    .trace-event {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      position: relative;
    }
    .trace-event::before {
      content: '';
      position: absolute;
      left: -5px;
      top: 8px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--colors-border);
      background: var(--colors-surface);
    }
    .trace-event.gate-decision::before {
      background: var(--colors-warning);
      border-color: var(--colors-warning);
    }
    .trace-event.tool-call::before {
      background: var(--colors-primary);
      border-color: var(--colors-primary);
    }
    .trace-event.tool-result::before {
      background: var(--colors-success);
      border-color: var(--colors-success);
    }
    .trace-event.derivation::before {
      background: var(--colors-info);
      border-color: var(--colors-info);
    }
    .trace-event.event::before {
      background: var(--colors-text-muted);
      border-color: var(--colors-text-muted);
    }
    .trace-event-time {
      min-width: 80px;
      color: var(--colors-text-muted);
      font-size: var(--text-xs);
      text-align: right;
      padding-top: 2px;
    }
    .trace-event-content {
      flex: 1;
      min-width: 0;
    }
    .trace-event-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 500;
      color: var(--colors-text);
    }
    .trace-event-kind {
      font-size: var(--text-xs);
      padding: 1px 6px;
      border-radius: var(--radii-full);
      background: var(--colors-surface);
      color: var(--colors-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .trace-event-details {
      margin-top: var(--space-1);
      padding-left: var(--space-3);
      border-left: 1px solid var(--colors-border);
      color: var(--colors-text-secondary);
      font-size: var(--text-xs);
    }
    .trace-event-link {
      color: var(--colors-primary);
      cursor: pointer;
      text-decoration: none;
    }
    .trace-event-link:hover {
      text-decoration: underline;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-8);
      color: var(--colors-text-muted);
      text-align: center;
    }
    .empty-state s-icon {
      font-size: 48px;
      margin-bottom: var(--space-3);
      opacity: 0.5;
    }
  `;

  @property({ type: Object }) focusRef!: FocusRef;

  @state() private traceEvents: Array<{
    block: SemanticBlock;
    kind: string;
    timestamp: number;
    details: string[];
  }> = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
  }

  protected override updated(): void {
    this.refresh();
  }

  private refresh(): void {
    if (!this.focusRef || this.focusRef.kind !== 'trace') {
      this.traceEvents = [];
      return;
    }

    const graph = $workspaceGraph.get();
    const resolution = resolveFocus(this.focusRef, { graph, depth: 2 });

    if (!resolution.trace?.events.length) {
      this.traceEvents = [];
      return;
    }

    // Sort events by timestamp
    const events = [...resolution.trace.events].sort((a, b) => a.createdAt - b.createdAt);

    this.traceEvents = events.map(block => ({
      block,
      kind: block.kind,
      timestamp: block.createdAt,
      details: this.extractDetails(block, graph),
    }));
  }

  private extractDetails(block: SemanticBlock, graph: ReturnType<typeof $workspaceGraph.get>): string[] {
    const details: string[] = [];

    // Add text content if present
    if (block.text) {
      details.push(block.text.slice(0, 200));
    }

    // Add uncertainty/truth if present
    if (block.uncertainty) {
      details.push(`Truth: f=${block.uncertainty.frequency.toFixed(2)}, c=${block.uncertainty.confidence.toFixed(2)}`);
    }

    // Add provenance refs
    if (block.provenanceRefs?.length) {
      details.push(`Provenance: ${block.provenanceRefs.join(', ')}`);
    }

    // Add linked blocks
    const links = [...graph.links.values()].filter(
      l => l.source === block.id || l.target === block.id
    );
    for (const link of links.slice(0, 3)) {
      const otherId = link.source === block.id ? link.target : link.source;
      const other = graph.blocks.get(otherId);
      if (other) {
        details.push(`${link.kind} → ${other.kind}:${other.id}`);
      }
    }

    return details;
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  }

  protected override renderBody(): TemplateResult {
    if (!this.focusRef || this.focusRef.kind !== 'trace') {
      return html`
        <div class="empty-state">
          <s-icon name="gitCompare"></s-icon>
          <p>Select a trace focus to view its timeline</p>
        </div>
      `;
    }

    if (this.traceEvents.length === 0) {
      return html`
        <div class="empty-state">
          <s-icon name="gitCompare"></s-icon>
          <p>No events found for correlation ID: ${this.focusRef.correlationId}</p>
        </div>
      `;
    }

    return html`
      <div class="trace-header">
        <div>
          <div style="font-weight: 500; color: var(--colors-text);">Trace</div>
          <span class="trace-correlation-id">${this.focusRef.correlationId}</span>
        </div>
        <div class="trace-summary">
          <span>${this.traceEvents.length} event${this.traceEvents.length !== 1 ? 's' : ''}</span>
          ${this.traceEvents.length > 0 ? html`
            <span>Span: ${this.formatTime(this.traceEvents[0]!.timestamp)} – ${this.formatTime(this.traceEvents[this.traceEvents.length - 1]!.timestamp)}</span>
          ` : nothing}
        </div>
      </div>
      <div class="trace-timeline">
        ${this.traceEvents.map(event => html`
          <div class="trace-event ${event.kind}">
            <div class="trace-event-time">${this.formatTime(event.timestamp)}</div>
            <div class="trace-event-content">
              <div class="trace-event-title">
                <s-icon name=${this.iconForKind(event.kind)} size="14"></s-icon>
                <span>${blockKindLabel(event.kind)}</span>
                <span class="trace-event-kind">${event.kind}</span>
              </div>
              ${event.details.length > 0 ? html`
                <div class="trace-event-details">
                  ${event.details.map(d => html`<div>${d}</div>`)}
                </div>
              ` : nothing}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private iconForKind(kind: string): string {
    switch (kind) {
      case 'gate-decision': return 'lightning';
      case 'tool-call': return 'tool';
      case 'tool-result': return 'check';
      case 'derivation': return 'tool';
      case 'event': return 'circle';
      case 'command': return 'play';
      case 'config-change': return 'settings';
      case 'error': return 'warningTriangle';
      default: return 'circle';
    }
  }
}

function blockKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    'gate-decision': 'Gate Decision',
    'tool-call': 'Tool Call',
    'tool-result': 'Tool Result',
    'derivation': 'Derivation',
    'event': 'Event',
    'command': 'Command',
    'config-change': 'Config Change',
    'error': 'Error',
    'claim': 'Claim',
    'goal': 'Goal',
    'question': 'Question',
    'answer': 'Answer',
    'turn': 'Turn',
  };
  return labels[kind] ?? kind;
}

const TRACE_VIEWER_SURFACE = {
  id: 'trace-viewer',
  title: 'Trace Viewer',
  group: 'instrument',
  a11y: { role: 'region' },
} as const;

defineSurface(
  {
    ...TRACE_VIEWER_SURFACE,
    capability: 'reasoning' as const,
    placement: 'panel' as const,
  },
  STraceViewer
);

declare global {
  interface HTMLElementTagNameMap {
    's-trace-viewer': STraceViewer;
  }
}