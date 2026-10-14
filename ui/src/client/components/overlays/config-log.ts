/**
 * Config-change log overlay — the audit trail of configuration adjustments,
 * read from the dedicated `$configChanges` store. It lives outside the workspace
 * graph on purpose: a graph projection is replaced wholesale by
 * `syncWorkspaceGraph`, which would wipe the trail.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { $configChanges } from '../../core/index.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { viewSource } from '../../core/view-sources.js';
import type { ViewSpec } from '../../core/view-spec.js';

@customElement('s-config-log')
export class ConfigLogView extends SurfaceComponent {
  static override styles = css`
    :host {
      position: fixed;
      top: 16vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(720px, 92vw);
      height: min(520px, 66vh);
      z-index: 1;
    }
    :host([hidden]) {
      display: none;
    }
    :host([data-pinned]) {
      position: fixed;
      top: var(--config-log-y, 16vh);
      left: var(--config-log-x, 50%);
      transform: var(--config-log-transform, translateX(-50%));
      width: var(--config-log-w, min(720px, 92vw));
      height: var(--config-log-h, min(520px, 66vh));
      z-index: 1;
    }
    .panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-panel);
      box-shadow: var(--shadows-panel);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
    }
    .title {
      font-weight: var(--typography-fontWeights-semibold);
    }
    .count {
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-muted);
    }
    .content {
      flex: 1;
      overflow: auto;
    }
    s-view {
      height: 100%;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($configChanges);
  }

  private getViewSpec(): ViewSpec {
    const changes = $configChanges.get();
    return {
      id: 'overlay:config-log',
      title: 'Config Changes',
      shapes: ['table', 'text'],
      shape: 'table',
      source: viewSource($configChanges, () => ({
        kind: 'table' as const,
        columns: [
          { id: 'time', label: 'Time', width: '20%' },
          { id: 'key', label: 'Key', width: '26%' },
          { id: 'change', label: 'Change', width: '54%' },
        ],
        rows: changes.map((block) => ({
          time: new Date(block.createdAt).toLocaleTimeString(),
          key: block.data?.from ?? block.title ?? '',
          change: `${block.data?.before ?? ''} → ${block.data?.after ?? ''}`,
          _id: block.id,
        })),
      })),
      states: {
        empty: {
          heading: 'No config changes',
          description: 'Adjust a setting to record the first change',
        },
      },
    };
  }

  private close = () => eventBus.emit('overlay:close', { id: 'config-log' });

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };

  protected override renderBody() {
    return html`
      <div class="panel" role="dialog" aria-label="Config Changes">
        <overlay-header
          overlay-id="config-log"
          title="Config Changes"
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <div class="header">
          <span class="title">Config Changes</span>
          <span class="count">${$configChanges.get().length}</span>
        </div>
        <div class="content">
          <s-view .spec=${this.getViewSpec()} .budget=${'full'} .chrome=${true}></s-view>
        </div>
      </div>
    `;
  }
}

const CONFIG_LOG_SURFACE = { id: 'config-log', title: 'Config Changes', group: 'overlay', a11y: { role: 'dialog' } } as const;

defineSurface(
  {
    ...CONFIG_LOG_SURFACE,
    capability: 'uiControl' as const,
    presentation: {
      hiddenInPalette: true,
      window: { draggable: true, resizable: true, minimize: true, persist: true },
    },
  },
  ConfigLogView
);

declare global {
  interface HTMLElementTagNameMap {
    's-config-log': ConfigLogView;
  }
}
