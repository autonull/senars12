/**
 * The semantic-neighborhood popover (§2.4, Phase 2). "Open related" on a block
 * lists the blocks it touches — grouped by relation and direction — and each row
 * navigates (focuses the block, closing the popover). Traversal is the pure
 * `neighborhood` projection; this overlay only presents and dispatches focus, so
 * graph, Notebook and palette share one navigation path. The hop count is session
 * state (`$neighborhoodDepth`, URL-owned) rather than a literal here, so a link can
 * pin how far "related" reaches.
 */

import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { blockDescriptor } from '../../core/block-descriptors.js';
import { eventBus } from '../../core/events.js';
import { type Neighbor, neighborhood } from '../../core/neighborhood.js';
import {
  $neighborhoodDepth,
  $workspaceGraph,
  setNeighborhoodDepth,
  setWorkspaceFocus,
} from '../../core/store.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';
// UI.17 attention runtime
import { attendFocus, tierOf, type FocusRef, focus, MIND_FOCUS } from '../../framework/index.js';

/** The hop counts "Open related" offers. */
const DEPTHS = [1, 2, 3] as const;

const labelOf = (neighbor: Neighbor): string =>
  neighbor.block.title ?? neighbor.block.text?.split('\n')[0]?.trim() ?? blockDescriptor(neighbor.block.kind).label;

@customElement('s-related')
export class RelatedView extends SurfaceComponent {
  static override styles = css`
    :host {
      position: fixed;
      top: 12vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(480px, 92vw);
      max-height: 70vh;
      z-index: 1;
    }
    :host([hidden]) {
      display: none;
    }
    .panel {
      display: flex;
      flex-direction: column;
      max-height: 70vh;
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-panel);
      box-shadow: var(--shadows-panel);
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-3);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
    }
    .kind {
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-muted);
    }
    .title {
      flex: 1;
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
      font-weight: var(--typography-fontWeights-semibold);
      color: var(--colors-semantic-text-primary);
    }
    .close {
      border: none;
      background: transparent;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      font-size: var(--typography-scale-base);
    }
    .body {
      padding: var(--spacing-scale-2);
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .group {
      margin: var(--spacing-scale-1) var(--spacing-scale-2) 0;
      font-size: var(--typography-scale-xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--colors-semantic-text-muted);
    }
    button.row {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      color: var(--colors-semantic-text-secondary);
      cursor: pointer;
      padding: var(--spacing-scale-1) var(--spacing-scale-2);
      border-radius: 4px;
      font-size: var(--typography-scale-sm);
    }
    button.row:hover {
      background: var(--colors-semantic-bg-subtle);
      color: var(--colors-semantic-text-primary);
    }
    .dir {
      color: var(--colors-semantic-accent-cyan);
      font-family: var(--typography-fontFamilies-data);
    }
    .label {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .attention-tier {
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-accent-cyan);
      opacity: 0.7;
    }
    .empty {
      padding: var(--spacing-scale-4);
      text-align: center;
      color: var(--colors-semantic-text-muted);
      font-size: var(--typography-scale-sm);
    }
  `;

  @property({ type: String }) ref = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
    this.watch($neighborhoodDepth);
    // Attend the focus block
    if (this.ref) {
      const focusRef = focus.concept(this.ref);
      attendFocus(focusRef, 'focus', 1.0);
    }
    // Attend all neighbors
    const graph = $workspaceGraph.get();
    const depth = $neighborhoodDepth.get();
    const model = neighborhood(graph, this.ref, depth);
    if (model) {
      for (const neighbor of model.neighbors) {
        const neighborFocus = focus.concept(neighbor.block.id);
        attendFocus(neighborFocus, 'ring', 0.5);
      }
    }
  }

  protected override renderBody() {
    const depth = $neighborhoodDepth.get();
    const model = neighborhood($workspaceGraph.get(), this.ref, depth);
    if (!model) return html`<div class="panel"><p class="empty">Block not found</p></div>`;
    const grouped = new Map<string, Neighbor[]>();
    for (const neighbor of model.neighbors) {
      const key = `${neighbor.direction === 'out' ? '→' : '←'} ${neighbor.link.label ?? neighbor.link.kind}`;
      const group = grouped.get(key);
      if (group) group.push(neighbor);
      else grouped.set(key, [neighbor]);
    }
    return html`
      <div class="panel" role="dialog" aria-label="Related blocks">
        <overlay-header
          overlay-id="related"
          .kind=${blockDescriptor(model.block.kind).label}
          .title=${model.block.title ?? model.block.id}
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <div
          class="depth"
          role="group"
          aria-label="Traversal depth"
          style="
            display:flex;
            align-items:center;
            gap:var(--spacing-scale-1);
            padding:var(--spacing-scale-2) var(--spacing-scale-3);
            border-bottom:1px solid var(--colors-semantic-border-subtle);
          "
        >
          <span
            style="
              font-size:var(--typography-scale-xs);
              text-transform:uppercase;
              letter-spacing:0.06em;
              color:var(--colors-semantic-text-muted);
            "
          >
            hops
          </span>
          ${DEPTHS.map(
            (hops) => html`<button
              data-depth=${hops}
              aria-pressed=${depth === hops}
              @click=${() => setNeighborhoodDepth(hops)}
            >
              ${hops}
            </button>`
          )}
        </div>
        <div class="body">
          ${
            model.neighbors.length === 0
              ? html`<p class="empty">No related blocks</p>`
              : [...grouped].map(
                  ([group, neighbors]) => html`
                    <span class="group">${group}</span>
                    ${neighbors.map(
                        (neighbor) => {
                          const neighborFocus = focus.concept(neighbor.block.id);
                          const tier = tierOf(neighborFocus);
                          return html`
                            <button
                              class="row"
                              data-related=${neighbor.block.id}
                              data-attention-tier=${tier}
                              @click=${() => this.go(neighbor.block.id)}
                            >
                              <span class="dir">${neighbor.direction === 'out' ? '→' : '←'}</span>
                              <span class="label">${labelOf(neighbor)}</span>
                              <span class="attention-tier">[${tier}]</span>
                            </button>
                          `;
                        }
                      )}
                  `
                )
          }
        </div>
      </div>
    `;
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'related' });

  private readonly go = (id: string): void => {
    setWorkspaceFocus(id);
    this.close();
  };

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };
}

const RELATED_SURFACE = { id: 'related', title: 'Related', group: 'overlay', a11y: { role: 'dialog' } } as const;

defineSurface(
  {
    ...RELATED_SURFACE,
    presentation: {
      hiddenInPalette: true,
    },
  },
  RelatedView
);

declare global {
  interface HTMLElementTagNameMap {
    's-related': RelatedView;
  }
}
