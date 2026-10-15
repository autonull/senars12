/**
 * One workspace block's body, rendered as the content of its graph node (the
 * modeless "conversation as graph nodes" paradigm). Reuses `renderBlockBody`, so
 * a node's content and the Notebook's are the same rendering and cannot drift;
 * Lit nodes only, so there is no `innerHTML` sink on this path.
 * Supports LoD tiers: 'card' (truncated summary) and 'full' (complete body).
 *
 * Inert until engaged (§Move 2.3): the body does not steal pan/zoom from the
 * graph. An explicit Engage affordance — or the node being focused — enters
 * interaction, so embedded content never fights the canvas by default.
 */

import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { $workspaceGraph } from '../core/store.js';
import { blockBodyStyles, renderBlockBody } from '../utils/render-block.js';
import { collectSources } from '../core/citations.js';
// UI.17 attention runtime
import { attendFocus, tierOf, type FocusRef, focus, MIND_FOCUS } from '../framework/index.js';

type NodeTier = 'card' | 'full';

@customElement('s-node-body')
export class SNodeBody extends BaseComponent {
  static override styles = [
    blockBodyStyles,
    css`
      :host {
        display: block;
        box-sizing: border-box;
        width: 240px;
        max-height: 200px;
        overflow: auto;
        padding: var(--spacing-scale-2);
        background: var(--colors-semantic-bg-panel-solid);
        border: 1px solid var(--colors-semantic-border-subtle);
        border-radius: var(--borderRadius-component-panel);
        box-shadow: var(--shadows-panel);
        font-size: var(--typography-scale-xs);
        pointer-events: none;
        transition: max-height var(--transitions-normal);
      }
      :host([engaged]) { pointer-events: auto; }
      :host([tier=card]) {
        max-height: 120px;
      }
      :host([tier=full]) {
        max-height: 300px;
      }
      :host([attention-tier=reclaimed]),
      :host([attention-tier=glyph]),
      :host([attention-tier=label]) {
        max-height: 60px;
      }
      .engage {
        position: sticky;
        top: 0;
        float: right;
        pointer-events: auto;
        padding: 1px 6px;
        border: 1px solid var(--colors-semantic-border-subtle);
        border-radius: var(--borderRadius-scale-sm);
        background: var(--colors-semantic-bg-panel-solid);
        color: var(--colors-semantic-accent-primary);
        cursor: pointer;
        font-family: inherit;
        font-size: var(--typography-scale-xs);
      }
    `,
  ];

  @property() ref = '';
  @property() tier: NodeTier = 'full';
  /** How many projections this body is nested inside (§Move 2.1). */
  @property({ type: Number }) depth = 0;
  /** Inert until engaged: pan/zoom passes through until the body is entered (§Move 2.3). */
  @property({ type: Boolean, reflect: true }) engaged = false;
  /** Current attention fidelity tier — drives render detail when not overridden by prop. */
  @state() private attentionTier: 'reclaimed' | 'glyph' | 'label' | 'card' | 'full' = 'full';
  /** The FocusRef this body attends. */
  private focusRef: FocusRef = MIND_FOCUS;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
    document.addEventListener('pointerdown', this.#releaseOnOutside, true);
    document.addEventListener('keydown', this.#releaseOnEscape);
    // Attend this body's focus
    this.focusRef = this.ref ? focus.concept(this.ref) : MIND_FOCUS;
    attendFocus(this.focusRef, 'focus', 1.0);
    // Watch attention tier
    this.watchAttentionTier();
  }

  override disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this.#releaseOnOutside, true);
    document.removeEventListener('keydown', this.#releaseOnEscape);
    // Release focus when unmounted
    if (this.focusRef !== MIND_FOCUS) {
      // Note: we don't call releaseFocus here to avoid releasing if another
      // instance of the same focus is still mounted. The attention field's
      // decay will naturally reclaim it.
    }
    super.disconnectedCallback();
  }

  /** Poll the attention tier each frame — cheap, no subscription boilerplate. */
  private watchAttentionTier(): void {
    const check = () => {
      if (!this.isConnected) return;
      const tier = tierOf(this.focusRef);
      if (tier !== this.attentionTier) this.attentionTier = tier;
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  /** A press on the canvas — anywhere outside this body — hands interaction back. */
  #releaseOnOutside = (event: PointerEvent): void => {
    if (this.engaged && !event.composedPath().includes(this)) this.engaged = false;
  };

  #releaseOnEscape = (event: KeyboardEvent): void => {
    if (this.engaged && event.key === 'Escape') this.engaged = false;
  };

  override render() {
    const graph = $workspaceGraph.get();
    const block = graph.blocks.get(this.ref);
    if (!block) return nothing;
    // Effective tier: explicit prop tier wins, otherwise attention tier drives it
    const effectiveTier = this.tier === 'full' && this.attentionTier !== 'full'
      ? (this.attentionTier === 'card' ? 'card' : 'card')
      : this.tier;
    // Reflect attention tier for CSS
    this.setAttribute('attention-tier', this.attentionTier);
    const sources = collectSources(graph);
    return html`
      <button class="engage" @click=${() => (this.engaged = !this.engaged)}>
        ${this.engaged ? 'Release' : 'Engage'}
      </button>
      ${renderBlockBody(block, sources, this.depth, effectiveTier)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-node-body': SNodeBody;
  }
}
