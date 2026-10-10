/**
 * The contextual block/link menu (§4.2, Phase 1.1/1.6). The per-block affordances
 * live on the block: ask a follow-up, explain it, open it in the graph, view its
 * provenance, copy it, and — when `reasoning` is on — formalize it as a
 * belief/goal. Affordances that need a capability or a producer that does not
 * exist yet are hidden rather than rendered inert, so the menu never offers a
 * silent no-op.
 */

import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Announcer } from '../../core/announcer.js';
import { artifactViewSpec } from '../../core/artifacts.js';
import { capabilityGate, $capabilities } from '../../core/capabilities.js';
import { $collapsedBlocks, $workspaceGraph, setWorkspaceFocus, toggleCollapsed } from '../../core/store.js';
import { eventBus } from '../../core/events.js';
import {
  $embeddedViews,
  embeddedViewMeta,
  embeddedViewsFor,
  type EmbeddedViewId,
  toggleEmbeddedView,
} from '../../core/embedded-views.js';
import { explainModel } from '../../core/explain.js';
import { neighborhood } from '../../core/neighborhood.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { $activeRenderer } from '../../core/store.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { linkMeta } from '../../utils/link-catalog.js';

@customElement('s-block-menu')
export class BlockMenuView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; left: 50%; bottom: calc(var(--spacing-scale-4) + 64px); transform: translateX(-50%); width: min(320px, 92vw); z-index: 1; }
    :host([hidden]) { display: none; }
    .menu { display: flex; flex-direction: column; padding: var(--spacing-scale-1); gap: 2px; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); }
    .menu button { display: flex; align-items: center; gap: var(--spacing-scale-2); width: 100%; text-align: left; border: none; border-radius: 4px; padding: var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-primary); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); }
    .menu button:hover { background: var(--colors-semantic-bg-subtle); }
    .menu .hint { padding: var(--spacing-scale-2); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
    .empty { padding: var(--spacing-scale-3); text-align: center; color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-sm); }
  `;

  @property({ type: String }) ref = '';
  @property({ type: String }) initialAction?: 'expand' | 'collapse';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
    this.watch($embeddedViews);
    this.watch($capabilities);
    this.watch($collapsedBlocks);
  }

  protected override renderBody() {
    const graph = $workspaceGraph.get();
    const model = explainModel(graph, this.ref);
    if (!model) return html`<div class="menu"><p class="empty">Block not found</p></div>`;
    const { block, links } = model;
    const hasProvenance = links.some((link) => linkMeta(link.kind).category === 'provenance');
    const hasArtifact = block.kind === 'image' || artifactViewSpec(block) !== undefined;
    const hasRelated = (neighborhood(graph, this.ref)?.neighbors.length ?? 0) > 0;
    const reasoning = capabilityGate('reasoning');
    const shown = $embeddedViews.get().get(this.ref) ?? new Set<EmbeddedViewId>();
    return html`
      <div class="menu" role="menu" aria-label="Block actions">
        <span class="hint">${block.title ?? block.id}</span>
        <button role="menuitem" data-action="follow-up" @click=${this.followUp}>Ask follow-up</button>
        <button role="menuitem" data-action="explain" @click=${this.explain}>Explain</button>
        ${
          hasRelated
            ? html`<button role="menuitem" data-action="related" @click=${this.openRelated}>Open related</button>`
            : ''
        }
        ${
          hasArtifact
            ? html`<button role="menuitem" data-action="artifact" @click=${this.openArtifact}>Open artifact</button>`
            : ''
        }
        ${
          this.embeddable().map(
            (id) => html`
              <button
                role="menuitemcheckbox"
                aria-checked=${shown.has(id)}
                data-action="embed"
                data-embed=${id}
                @click=${() => toggleEmbeddedView(this.ref, id)}
              >
                Embed · ${embeddedViewMeta(id).label}
              </button>
            `
          )
        }
        ${
          (block.children?.length ?? 0) > 0
            ? html`
                <button
                  role="menuitem"
                  data-action=${$collapsedBlocks.get().has(this.ref) ? 'expand' : 'collapse'}
                  @click=${() => toggleCollapsed(this.ref)}
                >
                  ${$collapsedBlocks.get().has(this.ref) ? 'Expand' : 'Collapse'} children
                </button>
              `
            : ''
        }
        <button role="menuitem" data-action="open-graph" @click=${this.openInGraph}>Open in graph</button>
        ${
          hasProvenance
            ? html`<button role="menuitem" data-action="provenance" @click=${this.explain}>View provenance</button>`
            : ''
        }
        ${
          reasoning
            ? html`<button role="menuitem" data-action="belief" @click=${this.formalizeBelief}>Formalize as belief</button>
              <button role="menuitem" data-action="goal" @click=${this.formalizeGoal}>Formalize as goal</button>`
            : ''
        }
        <button role="menuitem" data-action="copy" @click=${this.copy}>Copy text</button>
      </div>
    `;
  }

  /** The derived views this block has something to show — an affordance is hidden, never inert. */
  private embeddable(): EmbeddedViewId[] {
    return embeddedViewsFor($workspaceGraph.get(), this.ref);
  }

  private readonly followUp = () => eventBus.emit('composer:focus', { refs: [this.ref] });

  private readonly openRelated = () => eventBus.emit('overlay:open', { id: 'related', ref: this.ref });

  private readonly formalizeBelief = () =>
    eventBus.emit('composer:focus', { refs: [this.ref], mode: 'believe' });

  private readonly formalizeGoal = () =>
    eventBus.emit('composer:focus', { refs: [this.ref], mode: 'goal' });

  private readonly explain = () =>
    eventBus.emit('overlay:open', { id: 'explain', ref: this.ref });

  private readonly openArtifact = () =>
    eventBus.emit('overlay:open', { id: 'artifact', ref: this.ref });

  private readonly openInGraph = () => {
    $activeRenderer.set('graph');
    setWorkspaceFocus(this.ref);
    eventBus.emit('overlay:close', { id: 'block-menu' });
  };

  private readonly copy = () => {
    const text = $workspaceGraph.get().blocks.get(this.ref)?.text ?? '';
    void navigator.clipboard?.writeText(text);
    Announcer.getInstance().announce('Copied block text');
    eventBus.emit('overlay:close', { id: 'block-menu' });
  };
}

const BLOCK_MENU_SURFACE = { id: 'block-menu', title: 'Block actions', group: 'overlay' } as const;

defineSurface(BLOCK_MENU_SURFACE, BlockMenuView);
registerOverlay({
  id: BLOCK_MENU_SURFACE.id,
  title: BLOCK_MENU_SURFACE.title,
  tag: surfaceTag(BLOCK_MENU_SURFACE),
});

declare global {
  interface HTMLElementTagNameMap {
    's-block-menu': BlockMenuView;
  }
}
