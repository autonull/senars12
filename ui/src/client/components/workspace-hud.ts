/**
 * The floating workspace HUD (§1, Phase 0.4) — the only always-present chrome,
 * and deliberately thin. It switches the active `WorkspaceRenderer` (the same
 * registry the shell mounts), shows the provider/backend chip, and expands two
 * popovers above the pill: a one-glance telemetry sparkline + latest-values
 * table, and a Panels menu derived from the `view.panel.*` commands. Controls
 * are added only when they do real work.
 */

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { activeCommands, dispatchCommand } from '../core/commands.js';
import { eventBus } from '../core/events.js';
import { GRAPH_LAYERS, type GraphLayer } from '../core/graph-layer.js';
import { $activeRenderer, $graphLayer, $lmStatus, $telemetry, setGraphLayer } from '../core/store.js';
import type { ViewSpec } from '../core/view-spec.js';
import { workspaceRenderers } from '../core/workspace-renderer.js';
import {
  DEFAULT_TELEMETRY_METRICS,
  TELEMETRY_RANGES,
  telemetrySeries,
  telemetrySnapshot,
  type TelemetryRange,
} from '../utils/telemetry-view.js';

const LAYER_LABELS: Record<GraphLayer, string> = {
  both: 'Both',
  conversation: 'Thread',
  concepts: 'Concepts',
};

@customElement('workspace-hud')
export class WorkspaceHud extends BaseComponent {
  static override styles = css`
    :host { position: absolute; bottom: calc(var(--composer-height, 0px) + var(--spacing-scale-4)); left: 50%; transform: translateX(-50%); z-index: var(--zIndex-layers-panel); }
    .hud {
      display: flex; align-items: center; gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-1) var(--spacing-scale-2);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 999px;
      background: var(--colors-semantic-bg-overlay);
      backdrop-filter: blur(8px);
      box-shadow: var(--shadows-md, 0 2px 12px rgb(0 0 0 / 0.3));
    }
    .modes, .layers { display: flex; gap: 2px; }
    .layers { border-left: 1px solid var(--colors-semantic-border-subtle); padding-left: var(--spacing-scale-2); }
    button {
      border: none; border-radius: 999px; cursor: pointer;
      padding: var(--spacing-scale-1) var(--spacing-scale-3);
      background: transparent; color: var(--colors-semantic-text-secondary);
      font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs);
    }
    button:hover { background: var(--colors-semantic-bg-subtle); color: var(--colors-semantic-text-primary); }
    button[aria-pressed='true'] { background: var(--colors-semantic-accent-cyan); color: var(--colors-semantic-bg-base); }
    .chip {
      padding: 0 var(--spacing-scale-2);
      color: var(--colors-semantic-text-muted);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
      border-left: 1px solid var(--colors-semantic-border-subtle);
    }
    .popover {
      position: absolute; bottom: calc(100% + var(--spacing-scale-2));
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel);
      box-shadow: var(--shadows-panel);
      overflow: hidden;
    }
    .stats { left: 50%; transform: translateX(-50%); width: min(340px, 92vw); }
    .stats header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-1) var(--spacing-scale-2); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .stats .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .ranges { display: flex; gap: 2px; }
    .ranges button { padding: 0 var(--spacing-scale-2); font-size: var(--typography-scale-xs); }
    .ranges button[aria-pressed='true'] { color: var(--colors-semantic-accent-primary); }
    .spark { height: 28px; padding: var(--spacing-scale-1) 0; }
    .snapshot { max-height: 132px; overflow: auto; }
    .panels { right: 0; display: flex; flex-direction: column; padding: var(--spacing-scale-1); min-width: 160px; }
    .panels button { text-align: left; border-radius: var(--borderRadius-scale-sm); }
  `;

  @state() private statsOpen = false;
  @state() private panelsOpen = false;
  @state() private range: TelemetryRange = '5m';
  @state() private metrics = new Set<string>(DEFAULT_TELEMETRY_METRICS);

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($activeRenderer);
    this.watch($graphLayer);
    this.watch($lmStatus);
    this.watch($telemetry);
  }

  override render() {
    const active = $activeRenderer.get();
    const layer = $graphLayer.get();
    const provider = $lmStatus.get().provider;
    const data = $telemetry.get();
    return html`
      ${this.statsOpen ? this.renderStats(data) : ''}
      ${this.panelsOpen ? this.renderPanels() : ''}
      <div class="hud" role="toolbar" aria-label="Workspace">
        <button
          data-action="toc"
          title="Table of contents"
          aria-label="Table of contents"
          @click=${(event: Event) =>
            eventBus.emit('overlay:open', { id: 'toc', anchor: event.currentTarget as HTMLElement })}
        >☰</button>
        <button
          data-action="timeline"
          title="Timeline"
          aria-label="Timeline"
          @click=${(event: Event) =>
            eventBus.emit('overlay:open', { id: 'timeline', anchor: event.currentTarget as HTMLElement })}
        >⏱</button>
        <button
          data-action="telemetry"
          title="Telemetry"
          aria-label="Telemetry"
          aria-pressed=${this.statsOpen}
          @click=${() => this.toggleStats()}
        >📈</button>
        <button
          data-action="panels"
          title="Panels"
          aria-label="Panels"
          aria-pressed=${this.panelsOpen}
          @click=${() => this.togglePanels()}
        >▾</button>
        <div class="modes">
          ${workspaceRenderers().map(
            (renderer) => html`
              <button
                data-renderer=${renderer.id}
                aria-pressed=${renderer.id === active}
                @click=${() => $activeRenderer.set(renderer.id)}
              >${renderer.label}</button>
            `
          )}
        </div>
        ${
          active === 'graph'
            ? html`
              <div class="layers" role="group" aria-label="Graph layer">
                ${GRAPH_LAYERS.map(
                  (id) => html`<button
                    data-layer=${id}
                    aria-pressed=${id === layer}
                    title=${`Show ${id}`}
                    @click=${() => setGraphLayer(id)}
                  >${LAYER_LABELS[id]}</button>`
                )}
              </div>
            `
            : ''
        }
        <button
          data-action="settings"
          title="Settings"
          aria-label="Settings"
          @click=${(event: Event) =>
            eventBus.emit('overlay:open', { id: 'settings', anchor: event.currentTarget as HTMLElement })}
        >⚙</button>
        <button
          data-action="palette"
          title="Command palette (⌘K)"
          aria-label="Command palette"
          @click=${(event: Event) =>
            eventBus.emit('overlay:open', { id: 'palette', anchor: event.currentTarget as HTMLElement })}
        >⌘K</button>
        ${typeof provider === 'string' ? html`<span class="chip" title="Language model provider">${provider}</span>` : ''}
      </div>
    `;
  }

  private renderStats(data: ReturnType<typeof $telemetry.get>) {
    const seriesSpec: ViewSpec = {
      id: 'hud-telemetry',
      title: 'Telemetry',
      shapes: ['series'],
      source: { get: () => ({ kind: 'series', series: telemetrySeries(data, this.metrics, this.range) }) },
    };
    const snapshotSpec: ViewSpec = {
      id: 'hud-telemetry-snapshot',
      title: 'Latest',
      shapes: ['table'],
      source: { get: () => telemetrySnapshot(data, this.metrics) },
    };
    return html`
      <div class="popover stats" role="region" aria-label="Telemetry">
        <header>
          <span class="title">Telemetry</span>
          <div class="ranges" role="group" aria-label="Range">
            ${TELEMETRY_RANGES.map(
              (r) => html`<button
                data-range=${r}
                aria-pressed=${this.range === r}
                @click=${() => this.setRange(r)}
              >${r}</button>`
            )}
          </div>
          <button
            data-action="telemetry-full"
            title="Open full telemetry"
            @click=${(event: Event) =>
              eventBus.emit('overlay:open', { id: 'telemetry', anchor: event.currentTarget as HTMLElement })}
          >Full</button>
        </header>
        <div class="spark"><s-view .spec=${seriesSpec} budget="embedded" .chrome=${false}></s-view></div>
        <div class="snapshot"><s-view .spec=${snapshotSpec} budget="embedded" .chrome=${false}></s-view></div>
      </div>
    `;
  }

  private renderPanels() {
    const panels = activeCommands().filter((command) => command.id.startsWith('view.panel.'));
    return html`
      <div class="popover panels" role="menu" aria-label="Panels">
        ${panels.map(
          (command) => html`<button
            role="menuitem"
            data-panel=${command.id}
            @click=${() => {
              dispatchCommand(command.id);
              this.panelsOpen = false;
            }}
          >${command.title.replace(/^Toggle /, '')}</button>`
        )}
      </div>
    `;
  }

  private toggleStats() {
    this.statsOpen = !this.statsOpen;
    this.panelsOpen = false;
  }

  private togglePanels() {
    this.panelsOpen = !this.panelsOpen;
    this.statsOpen = false;
  }

  private setRange(range: TelemetryRange) {
    this.range = range;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workspace-hud': WorkspaceHud;
  }
}
