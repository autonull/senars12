import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import {
  $activeRenderer,
  $collapsedBlocks,
  $connectionState,
  $graphNodes,
  $panels,
  $selectedEdgeId,
  $selectedNodeId,
  $viewSelection,
  $workspaceGraph,
  eventBus,
  mountTestApi,
  navigationForKey,
  OverlayHost,
  overlays,
  setWorkspaceFocus,
} from '../core/index.js';
import { dispatchCommand } from '../core/commands.js';
import './overlays/index.js';

const isEditableTarget = (event: KeyboardEvent): boolean =>
  event.composedPath().some(
    (node) =>
      node instanceof HTMLElement &&
      (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName))
  );
import '../spacegraph/spacegraph-viewport.js';
import './graph-toolbar.js';
import './renderers/notebook.js';
import './workspace-host.js';
import './workspace-hud.js';
import './composer-focus.js';
import './contradiction-badge.js';
import './connection-banner.js';
import './lm-status-panel.js';
import './error-boundary.js';
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

    .panel-left { flex-shrink: 0; overflow: hidden; border-right: 1px solid var(--colors-semantic-border-subtle); }
    .panel-right { flex-shrink: 0; overflow: hidden; border-left: 1px solid var(--colors-semantic-border-subtle); }

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

  #overlays?: OverlayHost;
  #overlaySubs: Array<() => void> = [];
  #onGlobalKey = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        dispatchCommand('overlay.palette');
      }
      return;
    }
    const overlays = this.#overlays?.manager;
    if (event.altKey || overlays?.hasModal() || overlays?.containsFocus()) return;
    if (isEditableTarget(event)) return;
    const graph = $workspaceGraph.get();
    const target = navigationForKey(graph, event.key, graph.focus, $collapsedBlocks.get());
    if (target === undefined) return;
    event.preventDefault();
    setWorkspaceFocus(target);
  };

  override connectedCallback() {
    super.connectedCallback();
    this.mountOverlays();
    window.addEventListener('keydown', this.#onGlobalKey);
    this.watch($connectionState);
    this.watch($panels);
    this.watch($graphNodes);
    this.watch($activeRenderer);
    this.watchWith($selectedNodeId, () => this.syncInspector());
    this.watchWith($selectedEdgeId, () => this.syncInspector());
    this.watchWith($viewSelection, (selection) => {
      if (selection.focus) $selectedNodeId.set(selection.focus);
    });
  }

  override disconnectedCallback() {
    window.removeEventListener('keydown', this.#onGlobalKey);
    for (const unsubscribe of this.#overlaySubs) unsubscribe();
    this.#overlaySubs = [];
    this.#overlays?.dispose();
    this.#overlays = undefined;
    super.disconnectedCallback();
  }

  private mountOverlays() {
    this.#overlays ??= new OverlayHost();
    this.#overlaySubs = [
      eventBus.on('overlay:open', ({ id, ref, anchor }) =>
        this.#overlays?.open(id, { ref, anchor })
      ),
      eventBus.on('overlay:close', ({ id }) => this.#overlays?.close(id)),
      eventBus.on('overlay:pin', ({ id, pinned }) => this.#overlays?.manager.setPinned(id, pinned)),
      eventBus.on('overlay:pin-toggle', () => {
        const manager = this.#overlays?.manager;
        const top = manager?.stack().at(-1);
        if (manager && top) manager.setPinned(top, !manager.pinned().includes(top));
      }),
      eventBus.on('overlay:minimize', ({ id, minimize }) =>
        minimize ? this.#overlays?.minimize(id) : this.#overlays?.restore(id)
      ),
      eventBus.on('overlay:maximize', ({ id, maximize }) =>
        maximize ? this.#overlays?.maximize(id) : this.#overlays?.unmaximize(id)
      ),
      eventBus.on('overlay:cascade', ({ offset }) => this.#overlays?.cascade(offset)),
      eventBus.on('overlay:tile', () => this.#overlays?.tile()),
    ];
    mountTestApi('overlays', {
      open: (id: string, ref?: string) => this.#overlays?.open(id, { ref }),
      close: (id?: string) => this.#overlays?.close(id),
      isOpen: (id: string) => this.#overlays?.isOpen(id),
      stack: () => this.#overlays?.stack(),
      pinned: () => this.#overlays?.manager.pinned(),
      descriptors: () => overlays(),
    });
  }

  /** The inspector popover follows the live selection: open while a node/edge is chosen. */
  private syncInspector() {
    const active = $selectedNodeId.get() !== null || $selectedEdgeId.get() !== null;
    if (active) this.#overlays?.open('inspector');
    else this.#overlays?.close('inspector');
  }

  override render() {
    const panels = $panels.get();
    const searchPanel = panels.get('search');
    const chatPanel = panels.get('chat');
    const lensDesignerPanel = panels.get('lens-designer');
    const hasNodes = $graphNodes.get().size > 0;
    const notebook = $activeRenderer.get() === 'notebook';

    return html`
      <div class="banner-area">
        <connection-banner></connection-banner>
        <lm-status-panel></lm-status-panel>
      </div>

      <div class="toolbar-area">
        ${notebook ? '' : html`<graph-toolbar></graph-toolbar>`}
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
            !notebook && !hasNodes
              ? html`
            <div class="empty-overlay">
              <s-empty-state icon="🧠" heading="SeNARS Cognitive HUD" description="Send a message to start populating the knowledge graph" size="lg">
                <s-button variant="primary" slot="action" @click=${this.focusInput}>Send a message</s-button>
              </s-empty-state>
            </div>
          `
              : ''
          }
          <workspace-host></workspace-host>
          <workspace-hud></workspace-hud>
          <composer-focus></composer-focus>
        </div>

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
      </div>

      <div class="bottom-area">
        <composer-focus></composer-focus>
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
    const composer = this.shadowRoot?.querySelector('composer-focus');
    (composer as { focusInput?: () => void })?.focusInput?.();
  }
}
