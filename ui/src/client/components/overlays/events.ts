/**
 * Events overlay — cognitive event log using the ViewSpec system.
 * Legacy events surface bridged to overlay + embedded view.
 */

import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { $cognitiveEvents, BaseComponent } from '../../core/index.js';
import type { CognitiveEvent } from '@senars/core';
import { viewSource } from '../../core/view-sources.js';
import type { Shape, ViewSpec } from '../../core/view-spec.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';

const EVENT_TYPE_LABELS: Record<string, string> = {
  'derivation.made': 'Derivation',
  'derivation.record': 'Derivation Record',
  'belief.revised': 'Belief Revised',
  'contradiction.detected': 'Contradiction',
  'budget.exhausted': 'Budget Exhausted',
  'egress.gate.rejected': 'Gate Rejected',
  'policy.violation': 'Policy Violation',
  'tool.executed': 'Tool Executed',
  'tool.approved': 'Tool Approved',
  'tool.rejected': 'Tool Rejected',
  'lm.call': 'LM Call',
  'lm.stream': 'LM Stream',
  'config.changed': 'Config Changed',
  'session.saved': 'Session Saved',
  'session.loaded': 'Session Loaded',
};

@customElement('s-events')
export class EventsView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 14vh; left: 50%; transform: translateX(-50%); width: min(800px, 94vw); height: min(600px, 70vh); z-index: 1; }
    :host([hidden]) { display: none; }
    :host([data-pinned]) { position: fixed; top: var(--events-y, 14vh); left: var(--events-x, 50%); transform: var(--events-transform, translateX(-50%)); width: var(--events-w, min(800px, 94vw)); height: var(--events-h, min(600px, 70vh)); z-index: 1; }
    .panel { display: flex; flex-direction: column; height: 100%; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    .header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .title { font-weight: var(--typography-fontWeights-semibold); }
    .count { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .filter { display: flex; gap: var(--spacing-scale-1); padding: var(--spacing-scale-1) var(--spacing-scale-2); border-bottom: 1px solid var(--colors-semantic-border-subtle); flex-wrap: wrap; }
    .filter-btn { padding: 2px 8px; border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-button); background: transparent; color: var(--colors-semantic-text-secondary); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); transition: var(--transitions-fast); }
    .filter-btn.active { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); background: var(--colors-semantic-accent-subtle); }
    .filter-btn:hover:not(.active) { border-color: var(--colors-semantic-border-default); color: var(--colors-semantic-text-primary); }
    .content { flex: 1; overflow: auto; }
    .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--colors-semantic-text-muted); }
    s-view { height: 100%; }
  `;

  @state() private filterType: string | 'all' = 'all';
  @state() private viewShape: Shape = 'table';
  @property({ type: Boolean }) embedded = false;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($cognitiveEvents);
  }

  private getFilteredEvents(): CognitiveEvent[] {
    const events = $cognitiveEvents.get();
    if (this.filterType === 'all') return events;
    return events.filter((e) => e.type === this.filterType);
  }

  private getEventTypes(): string[] {
    const types = new Set<string>();
    for (const event of $cognitiveEvents.get()) {
      types.add(event.type);
    }
    return [...types].sort();
  }

  private getViewSpec(): ViewSpec {
    const events = this.getFilteredEvents();
    const tableData = {
      kind: 'table' as const,
      columns: [
        { id: 'time', label: 'Time', width: '15%' },
        { id: 'type', label: 'Type', width: '20%' },
        { id: 'detail', label: 'Detail', width: '65%' },
      ],
      rows: events.map((e, i) => ({
        time: new Date(e.timestamp).toLocaleTimeString(),
        type: EVENT_TYPE_LABELS[e.type] ?? e.type,
        detail: this.formatEventDetail(e),
        _id: `event-${i}`,
      })),
    };

    return {
      id: 'overlay:events',
      title: 'Event Log',
      shapes: ['table', 'tree', 'text'],
      shape: this.viewShape,
      source: viewSource($cognitiveEvents, () => tableData),
    };
  }

  private formatEventDetail(event: CognitiveEvent): string {
    const payload = event.payload as Record<string, unknown>;
    const parts: string[] = [];
    if (payload.engine) parts.push(`engine: ${payload.engine}`);
    if (payload.correlationId) parts.push(`id: ${payload.correlationId}`);
    if (payload.budgetType) parts.push(`budget: ${payload.budgetType}`);
    if (payload.gate) parts.push(`gate: ${payload.gate}`);
    if (payload.policyId) parts.push(`policy: ${payload.policyId}`);
    if (payload.tool) parts.push(`tool: ${payload.tool}`);
    if (payload.provider) parts.push(`provider: ${payload.provider}`);
    if (payload.conclusion) parts.push(payload.conclusion as string);
    return parts.join(' · ') || JSON.stringify(payload);
  }

  private setFilter(type: string | 'all') {
    this.filterType = type;
  }

  private setShape(shape: Shape) {
    this.viewShape = shape;
  }

  private close = () => eventBus.emit('overlay:close', { id: 'events' });

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };

  protected override renderBody() {
    if (this.embedded) {
      return html`<s-view .spec=${this.getViewSpec()} .budget=${'embedded'} .chrome=${false}></s-view>`;
    }

    const events = this.getFilteredEvents();
    const types = this.getEventTypes();

    return html`
      <div class="panel" role="dialog" aria-label="Event Log">
        <overlay-header
          overlay-id="events"
          title="Event Log"
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <div class="header">
          <span class="title">Event Log</span>
          <span class="count">${events.length} / ${$cognitiveEvents.get().length}</span>
        </div>
        <div class="filter">
          <button class="filter-btn ${this.filterType === 'all' ? 'active' : ''}" @click=${() => this.setFilter('all')}>All</button>
          ${types.map((type) => html`
            <button class="filter-btn ${this.filterType === type ? 'active' : ''}" @click=${() => this.setFilter(type)}>${EVENT_TYPE_LABELS[type] ?? type}</button>
          `)}
        </div>
        <div class="content">
          ${
            events.length === 0
              ? html`<div class="empty">No events${this.filterType !== 'all' ? ` of type ${EVENT_TYPE_LABELS[this.filterType] ?? this.filterType}` : ''}</div>`
              : html`<s-view .spec=${this.getViewSpec()} .budget=${'full'} .chrome=${true}></s-view>`
          }
        </div>
      </div>
    `;
  }
}

const EVENTS_SURFACE = { id: 'events', title: 'Event Log', group: 'overlay' } as const;

defineSurface(EVENTS_SURFACE, EventsView);
registerOverlay({
  id: EVENTS_SURFACE.id,
  title: EVENTS_SURFACE.title,
  tag: surfaceTag(EVENTS_SURFACE),
  window: { draggable: true, resizable: true, minimize: true, persist: true },
});

declare global {
  interface HTMLElementTagNameMap {
    's-events': EventsView;
  }
}