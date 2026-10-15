/**
 * Gate inspector — stands at the kernel gates to observe, veto, or inject
 * (§18.3). Shows what arrives at each gate, why it was admitted/refused.
 */

import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { $cognitiveEvents } from '../../core/store.js';
import { type CognitiveEvent } from '@senars/core';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import '../primitives/icon.js';

type GateKind = 'perception' | 'action' | 'reward' | 'budget';

@customElement('s-gate-inspector')
export class SGateInspector extends SurfaceComponent {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--fonts-mono);
      font-size: var(--text-sm);
    }
    .gate-tabs {
      display: flex;
      gap: var(--space-1);
      padding: var(--space-2);
      background: var(--colors-surface-elevated);
      border: 1px solid var(--colors-border);
      border-radius: var(--radii-md) var(--radii-md) 0 0;
      border-bottom: none;
    }
    .gate-tab {
      padding: var(--space-1) var(--space-3);
      background: transparent;
      border: none;
      color: var(--colors-text-secondary);
      cursor: pointer;
      border-radius: var(--radii-sm) var(--radii-sm) 0 0;
      font-family: var(--fonts-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: color var(--transitions-fast), background var(--transitions-fast);
    }
    .gate-tab:hover {
      color: var(--colors-text);
      background: var(--colors-surface-hover);
    }
    .gate-tab.active {
      color: var(--colors-primary);
      background: var(--colors-primary-bg);
    }
    .gate-panel {
      border: 1px solid var(--colors-border);
      border-radius: 0 0 var(--radii-md) var(--radii-md);
      background: var(--colors-surface-elevated);
      max-height: 400px;
      overflow-y: auto;
    }
    .gate-event {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-3);
      border-bottom: 1px solid var(--colors-border);
    }
    .gate-event:last-child {
      border-bottom: none;
    }
    .gate-event-time {
      min-width: 100px;
      color: var(--colors-text-muted);
      font-size: var(--text-xs);
      white-space: nowrap;
    }
    .gate-event-type {
      min-width: 120px;
      font-weight: 500;
      color: var(--colors-text);
    }
    .gate-event-type.admitted {
      color: var(--colors-success);
    }
    .gate-event-type.refused {
      color: var(--colors-error);
    }
    .gate-event-type.pending {
      color: var(--colors-warning);
    }
    .gate-event-details {
      flex: 1;
      min-width: 0;
      color: var(--colors-text-secondary);
      font-size: var(--text-xs);
    }
    .gate-event-term {
      font-family: var(--fonts-mono);
      background: var(--colors-surface);
      padding: 1px 4px;
      border-radius: var(--radii-sm);
    }
    .gate-event-reason {
      margin-top: var(--space-1);
      font-style: italic;
    }
    .gate-event-actions {
      display: flex;
      gap: var(--space-1);
    }
    .gate-action-btn {
      padding: var(--space-1) var(--space-2);
      font-size: var(--text-xs);
      border: 1px solid var(--colors-border);
      background: var(--colors-surface);
      color: var(--colors-text);
      border-radius: var(--radii-sm);
      cursor: pointer;
      transition: background var(--transitions-fast);
    }
    .gate-action-btn:hover {
      background: var(--colors-surface-hover);
    }
    .gate-action-btn.veto {
      border-color: var(--colors-error);
      color: var(--colors-error);
    }
    .gate-action-btn.veto:hover {
      background: var(--colors-error-bg);
    }
    .gate-action-btn.inject {
      border-color: var(--colors-primary);
      color: var(--colors-primary);
    }
    .gate-action-btn.inject:hover {
      background: var(--colors-primary-bg);
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
    .event-count {
      font-size: var(--text-xs);
      color: var(--colors-text-muted);
      padding: var(--space-1) var(--space-3);
    }
  `;

  @property({ type: String }) selectedGate: GateKind = 'perception';

  @state() private events: CognitiveEvent[] = [];
  @state() private filteredEvents: CognitiveEvent[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($cognitiveEvents);
  }

  protected override updated(): void {
    this.events = $cognitiveEvents.get();
    this.filterEvents();
  }

  private filterEvents(): void {
    // Filter events by gate kind (this is a simplified mapping)
    const gateEventTypes: Record<GateKind, string[]> = {
      perception: ['perception.admit', 'perception.refuse', 'perception.formalize'],
      action: ['action.authorize', 'action.veto', 'action.execute'],
      reward: ['reward.accept', 'reward.refuse', 'reward.mutate'],
      budget: ['budget.charge', 'budget.refuse', 'budget.exhaust'],
    };

    const types = gateEventTypes[this.selectedGate] ?? [];
    this.filteredEvents = this.events
      .filter(e => types.some(t => e.type.startsWith(t)))
      .slice(-50); // Last 50 events
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  }

  private getEventStatus(event: CognitiveEvent): 'admitted' | 'refused' | 'pending' {
    // Simplified status extraction
    if (event.type.includes('.refuse') || event.type.includes('.veto')) return 'refused';
    if (event.type.includes('.pending')) return 'pending';
    return 'admitted';
  }

  private getEventDetails(event: CognitiveEvent): string {
    const data = event as any;
    const parts: string[] = [];

    if (data.term) parts.push(`Term: <code class="gate-event-term">${data.term}</code>`);
    if (data.taskType) parts.push(`Type: ${data.taskType}`);
    if (data.sourceQuality) parts.push(`Source: ${data.sourceQuality}`);
    if (data.reason) parts.push(`Reason: ${data.reason}`);
    if (data.confidence !== undefined) parts.push(`Confidence: ${data.confidence.toFixed(2)}`);
    if (data.budgetDimension) parts.push(`Budget: ${data.budgetDimension}`);
    if (data.cost !== undefined) parts.push(`Cost: ${data.cost}`);

    return parts.join(' · ');
  }

  private handleVeto(event: CognitiveEvent): void {
    // Send veto to kernel
    console.log('[GateInspector] Veto event:', event);
  }

  private handleInject(): void {
    // Open dialog to inject a new event
    console.log('[GateInspector] Inject at gate:', this.selectedGate);
  }

  protected override renderBody(): TemplateResult {
    return html`
      <div class="gate-tabs">
        ${(['perception', 'action', 'reward', 'budget'] as GateKind[]).map(gate => html`
          <button
            class="gate-tab ${this.selectedGate === gate ? 'active' : ''}"
            @click=${() => { this.selectedGate = gate; this.filterEvents(); }}
          >
            ${gate}
          </button>
        `)}
      </div>
      <div class="gate-panel">
        ${this.filteredEvents.length === 0 ? html`
          <div class="empty-state">
            <s-icon name="filter"></s-icon>
            <p>No ${this.selectedGate} gate events</p>
          </div>
        ` : html`
          <div class="event-count">${this.filteredEvents.length} event${this.filteredEvents.length !== 1 ? 's' : ''}</div>
          ${this.filteredEvents.map(event => html`
            <div class="gate-event">
              <div class="gate-event-time">${this.formatTime(event.timestamp)}</div>
              <div class="gate-event-type ${this.getEventStatus(event)}">${event.type}</div>
              <div class="gate-event-details">
                ${this.getEventDetails(event)}
                ${event.type.includes('.refuse') || event.type.includes('.veto') ? html`
                  <div class="gate-event-reason">Refused: ${(event as any).reason ?? 'No reason given'}</div>
                ` : nothing}
              </div>
              <div class="gate-event-actions">
                ${(event.type.includes('.admit') || event.type.includes('.authorize') || event.type.includes('.pending')) && !event.type.includes('.refuse') ? html`
                  <button class="gate-action-btn veto" @click=${() => this.handleVeto(event)} title="Veto this admission">
                    <s-icon name="block" size="12"></s-icon> Veto
                  </button>
                ` : nothing}
              </div>
            </div>
          `)}
        `}
      </div>
    `;
  }
}

const GATE_INSPECTOR_SURFACE = {
  id: 'gate-inspector',
  title: 'Gate Inspector',
  group: 'instrument',
  a11y: { role: 'region' },
} as const;

defineSurface(
  {
    ...GATE_INSPECTOR_SURFACE,
    capability: 'reasoning' as const,
    placement: 'panel' as const,
  },
  SGateInspector
);

declare global {
  interface HTMLElementTagNameMap {
    's-gate-inspector': SGateInspector;
  }
}