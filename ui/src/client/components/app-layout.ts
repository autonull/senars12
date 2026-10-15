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
  $workspaceGraph,
  eventBus,
  mountTestApi,
  navigationForKey,
  OverlayHost,
  overlays,
  setWorkspaceFocus,
} from '../core/index.js';
import { dispatchCommand } from '../core/commands.js';
import { $activeLens } from '../core/index.js';
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
import './bottom-bar.js';
import './panel-dock.js';
import './contradiction-badge.js';
import './error-boundary.js';
import './chat-history-panel.js';
import './lens-designer.js';
import './connection-banner.js';
import './primitives/empty-state.js';

@customElement('app-layout')
export class AppLayout extends BaseComponent {
  static override styles = css`
    :host {
      display: grid; height: 100vh;
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "top"
        "body"
        "bottom";
      container-type: inline-size;
      container-name: app;
    }

    .top-area { grid-area: top; display: flex; flex-direction: column; }
    .toolbar-area { flex: 0 0 auto; }
    .banner-area { flex: 0 0 auto; }

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

    @container app (min-width: 1025px) {
      .panel-left { max-width: 360px; }
      .panel-right { max-width: 400px; }
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

    // Graph-specific shortcuts (no modifiers)
    const graph = $workspaceGraph.get();
    if ($activeRenderer.get() === 'graph-2d') {
      switch (event.key.toLowerCase()) {
        case 'a': {
          event.preventDefault();
          dispatchCommand('graph.ask-selection');
          return;
        }
      }
    }

    const target = navigationForKey(graph, event.key, graph.focus, $collapsedBlocks.get());
    if (target === undefined) return;
    event.preventDefault();
    setWorkspaceFocus(target);
  };

  override connectedCallback() {
    super.connectedCallback();
    this.mountOverlays();
    window.addEventListener('keydown', this.#onGlobalKey);
    this.watch($panels);
    this.watch($graphNodes);
    this.watch($workspaceGraph);
    this.watch($activeRenderer);
    this.watchWith($selectedNodeId, () => this.syncInspector());
    this.watchWith($selectedEdgeId, () => this.syncInspector());
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
    const hasNodes = $graphNodes.get().size > 0 || $workspaceGraph.get().blocks.size > 0;
    const notebook = $activeRenderer.get() === 'notebook';
    const anyPanelOpen = searchPanel?.open || chatPanel?.open || lensDesignerPanel?.open;

    return html`
      <div class="top-area">
        <div class="toolbar-area">
          ${notebook ? '' : html`<graph-toolbar></graph-toolbar>`}
        </div>
        <div class="banner-area"><connection-banner></connection-banner></div>
      </div>

      <div class="body-area">
        ${
          searchPanel?.open || chatPanel?.open || lensDesignerPanel?.open
            ? html`
          <div class="panel-right" style=${anyPanelOpen ? `width:360px` : 'width:0;overflow:hidden;'}>
            <panel-dock></panel-dock>
          </div>
        `
            : ''
        }

        <div class="graph-area">
${
              !notebook && !hasNodes
                ? html`
            <div class="empty-overlay">
              <s-empty-state
                icon="brain"
                heading="SeNARS Cognitive HUD"
                description="Send a message to start populating the knowledge graph"
                size="lg"
              >
                <s-button variant="primary" slot="action" @click=${this.focusInput}>
                  Send a message
                </s-button>
              </s-empty-state>
            </div>
          `
                : ''
            }
          <workspace-host></workspace-host>
        </div>
      </div>

      <div class="bottom-area">
        <bottom-bar></bottom-bar>
      </div>

      <error-boundary></error-boundary>
    `;
  }

  private focusInput() {
    const composer = this.shadowRoot?.querySelector('bottom-bar');
    (composer as { focusInput?: () => void })?.focusInput?.();
  }
}
