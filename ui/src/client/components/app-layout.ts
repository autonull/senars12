import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import {
  $connectionState,
  $graphNodes,
  $panels,
  $selectedNodeId,
  $viewportMode,
} from '../core/index.js';
import './graph-viewport.js';
import '../spacegraph/spacegraph-viewport.js';
import './graph-toolbar.js';
import './input-hud.js';
import './config-hud.js';
import './telemetry-panel.js';
import './timeline-scrubber.js';
import './contradiction-badge.js';
import './connection-banner.js';
import './error-boundary.js';
import './node-detail-drawer.js';
import './chat-history-panel.js';
import './lens-designer.js';
import './primitives/empty-state.js';

@customElement('app-layout')
export class AppLayout extends BaseComponent {
  static override styles = css`
    :host {
      display: grid; height: 100vh;
      grid-template-rows: auto 44px 1fr auto;
      grid-template-areas:
        "banner"
        "toolbar"
        "body"
        "bottom";
      container-type: inline-size;
      container-name: app;
    }

    .banner-area { grid-area: banner; }
    .toolbar-area { grid-area: toolbar; }
    .body-area {
      grid-area: body; display: flex; min-height: 0;
      position: relative; overflow: hidden;
    }
    .graph-area {
      flex: 1; min-width: 0; position: relative;
      display: flex; flex-direction: column;
    }
    graph-viewport { flex: 1; min-height: 0; }
    spacegraph-viewport { flex: 1; min-height: 0; }

    .panel-left { flex-shrink: 0; overflow: hidden; border-right: 1px solid var(--colors-semantic-border-subtle); }
    .panel-right { flex-shrink: 0; overflow: hidden; border-left: 1px solid var(--colors-semantic-border-subtle); }
    .panel-bottom { position: absolute; bottom: 0; left: 0; right: 0; z-index: var(--zIndex-layers-panel); overflow: hidden; border-top: 1px solid var(--colors-semantic-border-subtle); }

    .bottom-area { grid-area: bottom; display: flex; flex-direction: column; }

    .empty-overlay {
      position: absolute; inset: 0; display: flex;
      align-items: center; justify-content: center;
      background: var(--colors-semantic-bg-base);
      z-index: 1;
    }

    @container app (max-width: 640px) {
      .body-area { flex-direction: column; }
      .panel-left, .panel-right { border: none; border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    }

    @container app (min-width: 641px) and (max-width: 1024px) {
      .panel-left { max-width: 280px; }
      .panel-right { max-width: 320px; }
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($connectionState);
    this.watch($panels);
    this.watch($graphNodes);
    this.watch($selectedNodeId);
    this.watch($viewportMode);
  }

  override render() {
    const panels = $panels.get();
    const configPanel = panels.get('config');
    const searchPanel = panels.get('search');
    const telemetryPanel = panels.get('telemetry');
    const chatPanel = panels.get('chat');
    const lensDesignerPanel = panels.get('lens-designer');
    const hasNodes = $graphNodes.get().size > 0;

    return html`
      <div class="banner-area">
        <connection-banner></connection-banner>
      </div>

      <div class="toolbar-area">
        <graph-toolbar></graph-toolbar>
      </div>

      <div class="body-area">
        ${
          searchPanel?.open
            ? html`
          <div class="panel-left" style=${this.getPanelStyle('search')}>
            <s-panel heading="Search" docked="left" closable @s-close=${() => this.togglePanel('search')}>
              <s-input type="search" placeholder="Search concepts…"></s-input>
              ${!hasNodes ? html`<s-empty-state icon="🔍" heading="No concepts" description="Send a message to populate the graph" size="sm"></s-empty-state>` : ''}
            </s-panel>
          </div>
        `
            : ''
        }

        <div class="graph-area">
          ${
            !hasNodes
              ? html`
            <div class="empty-overlay">
              <s-empty-state icon="🧠" heading="SeNARS Cognitive HUD" description="Send a message to start populating the knowledge graph" size="lg">
                <s-button variant="primary" slot="action" @click=${this.focusInput}>Send a message</s-button>
              </s-empty-state>
            </div>
          `
              : ''
          }
          ${
            $viewportMode.get() === '3d'
              ? html`<spacegraph-viewport></spacegraph-viewport>`
              : html`<graph-viewport></graph-viewport>`
          }
        </div>

        ${
          configPanel?.open
            ? html`
          <div class="panel-right" style=${this.getPanelStyle('config')}>
            <s-panel heading="Configuration" docked="right" closable @s-close=${() => this.togglePanel('config')}>
              <config-hud></config-hud>
            </s-panel>
          </div>
        `
            : ''
        }

        ${
          $selectedNodeId.get()
            ? html`
          <div class="panel-right" style="width:300px;overflow:hidden;border-left:1px solid var(--colors-semantic-border-subtle);">
            <s-panel heading="Node Detail" docked="right" closable @s-close=${() => $selectedNodeId.set(null)}>
              <node-detail-drawer></node-detail-drawer>
            </s-panel>
          </div>
        `
            : ''
        }

        ${
          chatPanel?.open
            ? html`
          <div class="panel-right" style=${this.getPanelStyle('chat')}>
            <s-panel heading="Chat History" docked="right" closable @s-close=${() => this.togglePanel('chat')}>
              <chat-history-panel></chat-history-panel>
            </s-panel>
          </div>
        `
            : ''
        }

        ${
          lensDesignerPanel?.open
            ? html`
          <div class="panel-right" style=${this.getPanelStyle('lens-designer')}>
            <s-panel heading="Lens Designer" docked="right" closable @s-close=${() => this.togglePanel('lens-designer')}>
              <lens-designer></lens-designer>
            </s-panel>
          </div>
        `
            : ''
        }

        ${
          telemetryPanel?.open
            ? html`
          <div class="panel-bottom" style="height:${telemetryPanel.size}px">
            <s-panel heading="Telemetry" docked="bottom" closable noPad @s-close=${() => this.togglePanel('telemetry')}>
              <telemetry-panel></telemetry-panel>
            </s-panel>
          </div>
        `
            : ''
        }
      </div>

      <div class="bottom-area">
        <input-hud></input-hud>
      </div>

      <div style="position:absolute;bottom:44px;left:0;right:0;height:60px;z-index:var(--zIndex-layers-panel)">
        <timeline-scrubber></timeline-scrubber>
      </div>

      <error-boundary></error-boundary>
    `;
  }

  private getPanelStyle(id: string): string {
    const panel = $panels.get().get(id);
    if (!panel || !panel.open) return 'width:0;overflow:hidden;';
    return `width:${panel.size}px;`;
  }

  private togglePanel(id: string) {
    const panels = new Map($panels.get());
    const panel = panels.get(id);
    if (panel) {
      panels.set(id, { ...panel, open: !panel.open });
      $panels.set(panels);
    }
  }

  private focusInput() {
    const hud = this.shadowRoot?.querySelector('input-hud');
    (hud as { focusInput?: () => void })?.focusInput?.();
  }
}
