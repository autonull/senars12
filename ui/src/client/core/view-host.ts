import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { defineSurface, SurfaceComponent, type SurfaceState } from './surface.js';
import { $viewSelection } from './store.js';
import { viewAdapterFor } from './view-adapter.js';
import { datasetIsEmpty, projectDataset } from './view-projection.js';
import type { Budget, Shape, ViewSpec } from './view-spec.js';

/**
 * `<s-view>` — the one host every dataset renders through. It resolves an adapter
 * by shape + budget, projects the dataset into that shape, and owns the shared
 * chrome (title, shape switcher, fullscreen) plus descriptor-driven empty/error
 * slots. A surface that needs many shapes embeds this instead of a renderer.
 */
export class ViewHost extends SurfaceComponent {
  static override styles = css`
    :host { display: block; min-height: 0; }
    .view { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .view.full { position: fixed; inset: 0; z-index: var(--zIndex-layers-modal); background: var(--colors-semantic-bg-base); }
    .chrome {
      display: flex; align-items: center; gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-1) var(--spacing-scale-3);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs);
    }
    .title { font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .spacer { flex: 1; }
    .switcher { display: flex; gap: var(--spacing-scale-1); }
    .shape-btn {
      padding: 1px 6px; border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-scale-sm); background: transparent;
      color: var(--colors-semantic-text-secondary); cursor: pointer;
      font-family: inherit; font-size: inherit; text-transform: capitalize;
    }
    .shape-btn.active { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
    .chrome-btn {
      padding: 1px 6px; border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-scale-sm); background: transparent;
      color: var(--colors-semantic-text-secondary); cursor: pointer;
      font-family: inherit; font-size: inherit;
    }
    .body { flex: 1; min-height: 0; overflow: auto; }
    .adapter { display: block; height: 100%; }
    .slot { padding: var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
  `;
  @property({ attribute: false }) spec?: ViewSpec;
  @property({ type: String }) budget: Budget = 'full';
  /** `false` drops the chrome — for a view embedded in a surface that owns its own header. */
  @property({ attribute: false }) chrome = true;
  @state() private shape?: Shape;
  @state() private fullscreen = false;
  private sourceUnsub: (() => void) | null = null;

  protected override surfaceState(): SurfaceState {
    const spec = this.spec;
    if (!spec) return 'empty';
    if (!viewAdapterFor(this.activeShape(), this.budget)) return 'error';
    if (this.activeShape() !== 'graph' && datasetIsEmpty(spec.source.get())) return 'empty';
    return 'ready';
  }

  protected override renderEmpty(): TemplateResult {
    return html`<div class="slot" role="status">No data</div>`;
  }

  protected override renderError(): TemplateResult {
    return html`<div class="slot" role="alert">No view adapter for this shape</div>`;
  }

  protected override renderBody(): TemplateResult {
    const spec = this.spec;
    const shape = this.activeShape();
    const adapter = viewAdapterFor(shape, this.budget);
    if (!spec || !adapter) return html``;
    const data = projectDataset(spec.source.get(), shape);
    const tag = unsafeStatic(adapter.tag);
    return html`
      <div class="view ${this.fullscreen ? 'full' : ''}">
        ${
          this.chrome
            ? html`<header class="chrome">
            <span class="title">${spec.title}</span>
            ${this.renderSwitcher()}
            <span class="spacer"></span>
            <button class="chrome-btn" @click=${() => (this.fullscreen = !this.fullscreen)}>
              ${this.fullscreen ? 'Exit' : 'Full'}
            </button>
          </header>`
            : nothing
        }
        <div class="body" @view-select=${this.handleSelect}>
          ${staticHtml`<${tag} class="adapter" .data=${data}
            .selection=${$viewSelection.get()} .budget=${this.budget}></${tag}>`}
        </div>
      </div>
    `;
  }

  protected override surfaceApi() {
    return {
      shapes: () => this.spec?.shapes ?? [],
      shape: () => this.activeShape(),
      setShape: (shape: Shape) => this.setShape(shape),
    };
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('spec')) this.resubscribe();
  }

  override disconnectedCallback(): void {
    this.sourceUnsub?.();
    this.sourceUnsub = null;
    super.disconnectedCallback();
  }

  private activeShape(): Shape {
    return this.shape ?? this.spec?.shape ?? this.spec?.shapes[0] ?? 'series';
  }

  private setShape(shape: Shape): void {
    this.shape = shape;
  }

  private renderSwitcher() {
    const spec = this.spec;
    if (!spec) return nothing;
    const shapes = spec.shapes.filter((shape) => viewAdapterFor(shape, this.budget));
    if (shapes.length < 2) return nothing;
    return html`<span class="switcher" role="tablist">
      ${shapes.map(
        (shape) => html`<button
          role="tab"
          aria-selected=${shape === this.activeShape()}
          class="shape-btn ${shape === this.activeShape() ? 'active' : ''}"
          @click=${() => this.setShape(shape)}>${shape}</button>`
      )}
    </span>`;
  }

  private handleSelect = (event: Event): void => {
    const detail = (event as CustomEvent<{ id?: string }>).detail;
    if (detail?.id) $viewSelection.set({ ...$viewSelection.get(), focus: detail.id });
  };

  private resubscribe(): void {
    this.sourceUnsub?.();
    this.sourceUnsub = null;
    const source = this.spec?.source;
    if (source?.subscribe) {
      this.sourceUnsub = source.subscribe(() => this.requestUpdate());
    }
  }
}

defineSurface({ id: 'view', title: 'View', group: 'Views' }, ViewHost);

declare global {
  interface HTMLElementTagNameMap {
    's-view': ViewHost;
  }
}