/**
 * UI Lab — a menu of layout metaphors plus a generative composer.
 *
 * `?v=<id>`          a named preset (separate page).
 * `?compose=1&...`   a point in the parameter space, live and shareable.
 * (no params)        the menu.
 *
 * The composer's controls are the dimensions of the space: which widgets, how
 * they are laid out, and the global graph controls. Randomize samples the space.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $activeLens, $graphFit, $graphLayer, $graphShape, $viewportMode } from '../../kernel/index.js';
import { BaseComponent } from '../../core/base-component.js';
import {
  LAYERS,
  LENSES,
  LAYOUTS,
  MODES,
  SHAPES,
  parseSpec,
  randomSpec,
  specToSearch,
  specToVariant,
  type Spec,
  WIDGETS,
} from './compose.js';
import { variantById, VARIANTS, type Variant } from './variants.js';

@customElement('lab-surface')
export class LabSurface extends BaseComponent {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
      font-family: var(--typography-fontFamilies-ui, system-ui, sans-serif);
    }
    header.lab {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 9px 16px;
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-panel-solid);
      flex: 0 0 auto;
      flex-wrap: wrap;
    }
    .wordmark { font-weight: 700; letter-spacing: 0.04em; }
    .wordmark span { color: var(--colors-semantic-accent-cyan, #4cc9f0); }
    .variant-name { font-weight: 600; white-space: nowrap; }
    .variant-blurb { color: var(--colors-semantic-text-muted); font-size: 12.5px; }
    nav { margin-left: auto; display: flex; gap: 6px; }
    nav a {
      color: var(--colors-semantic-text-secondary);
      text-decoration: none;
      font-size: 12px;
      padding: 4px 10px;
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 999px;
    }
    nav a:hover { color: var(--colors-semantic-text-primary); border-color: var(--colors-semantic-accent-cyan, #4cc9f0); }
    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-base);
      flex: 0 0 auto;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .controls label { display: inline-flex; align-items: center; gap: 6px; color: var(--colors-semantic-text-muted); }
    select, input.link {
      background: var(--colors-semantic-bg-panel-solid);
      color: var(--colors-semantic-text-primary);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 6px;
      padding: 4px 8px;
      font: inherit;
      outline: none;
    }
    input.link { width: 260px; color: var(--colors-semantic-text-secondary); }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .chip {
      border: 1px solid var(--colors-semantic-border-subtle);
      background: transparent;
      color: var(--colors-semantic-text-secondary);
      border-radius: 999px;
      padding: 3px 9px;
      font: inherit;
      cursor: pointer;
    }
    .chip[data-on='true'] { background: var(--colors-semantic-accent-cyan, #4cc9f0); color: #04121a; border-color: transparent; }
    .chip:hover { border-color: var(--colors-semantic-accent-cyan, #4cc9f0); }
    button.act {
      border: 1px solid var(--colors-semantic-accent-cyan, #4cc9f0);
      background: transparent;
      color: var(--colors-semantic-accent-cyan, #4cc9f0);
      border-radius: 999px;
      padding: 4px 12px;
      font: inherit;
      cursor: pointer;
    }
    button.act:hover { background: var(--colors-semantic-accent-cyan, #4cc9f0); color: #04121a; }
    .grid { flex: 1 1 auto; display: grid; min-height: 0; }
    .grid > section {
      min-width: 0; min-height: 0; overflow: hidden; position: relative;
      display: flex; flex-direction: column;
      border: 1px solid var(--colors-semantic-border-subtle);
    }
    .grid > section > * { flex: 1 1 auto; min-height: 0; }
    .index { flex: 1 1 auto; overflow: auto; padding: 22px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; align-content: start; }
    .card {
      display: block; padding: 14px; border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 10px; background: var(--colors-semantic-bg-panel-solid); color: inherit;
      text-decoration: none; transition: border-color 0.15s, transform 0.15s;
    }
    .card:hover { border-color: var(--colors-semantic-accent-cyan, #4cc9f0); transform: translateY(-1px); }
    .card.accent { border-color: var(--colors-semantic-accent-cyan, #4cc9f0); }
    .card h3 { margin: 0 0 6px; font-size: 14px; }
    .card p { margin: 0; font-size: 12px; line-height: 1.5; color: var(--colors-semantic-text-muted); }
    .leadv { padding: 22px 22px 0; color: var(--colors-semantic-text-muted); max-width: 800px; }
    .leadv h1 { font-size: 19px; color: var(--colors-semantic-text-primary); margin: 0 0 8px; }
  `;

  private readonly params = new URLSearchParams(globalThis.location?.search ?? '');
  @state() private variantId = this.params.get('v') ?? '';
  @state() private compose = this.params.has('compose');
  @state() private spec: Spec = parseSpec(this.params);
  private filledFor = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.applyGlobals();
  }

  private applyGlobals(): void {
    const variant = this.activeVariant();
    // The Lab is a wall of small cells: show every cell's whole graph, not a
    // legible crop (a composable metaphor is judged on what it shows, not on how
    // far it zooms in).
    $graphFit.set('fit');
    if (variant?.mode) $viewportMode.set(variant.mode);
    if (variant?.shape) $graphShape.set(variant.shape);
    if (this.compose) {
      $activeLens.set(this.spec.lens);
      $graphLayer.set(this.spec.layer as never);
    }
  }

  private activeVariant(): Variant | undefined {
    if (this.compose) return specToVariant(this.spec);
    return variantById(this.variantId);
  }

  private signature(): string {
    return this.compose ? specToSearch(this.spec) : this.variantId;
  }

  override updated(): void {
    const variant = this.activeVariant();
    if (!variant || this.filledFor === this.signature()) return;
    this.filledFor = this.signature();
    this.applyGlobals();
    const grid = this.renderRoot.querySelector<HTMLElement>('.grid');
    if (!grid) return;
    for (const [area, tags] of Object.entries(variant.regions)) {
      const cell = grid.querySelector<HTMLElement>(`[data-area="${area}"]`);
      if (cell) cell.replaceChildren(...tags.map((tag) => document.createElement(tag)));
    }
  }

  private navigate(spec: Spec): void {
    this.spec = spec;
    globalThis.history?.replaceState(null, '', specToSearch(spec));
  }

  private onSelect(key: keyof Spec) {
    return (event: Event) => this.navigate({ ...this.spec, [key]: (event.target as HTMLSelectElement).value });
  }

  private toggleWidget = (id: string) => {
    const has = this.spec.widgets.includes(id);
    const widgets = has ? this.spec.widgets.filter((x) => x !== id) : [...this.spec.widgets, id];
    this.navigate({ ...this.spec, widgets });
  };

  private select(styles: readonly string[], value: string, on: (e: Event) => void, aria: string) {
    return html`<select aria-label=${aria} @change=${on}>
      ${styles.map((s) => html`<option value=${s} ?selected=${s === value}>${s}</option>`)}
    </select>`;
  }

  private renderControls(): TemplateResult {
    return html`
      <div class="controls">
        <label>layout ${this.select(LAYOUTS.map((l) => l.id), this.spec.layout, this.onSelect('layout'), 'Layout')}</label>
        <label>mode ${this.select(MODES, this.spec.mode, this.onSelect('mode'), 'Graph mode')}</label>
        <label>shape ${this.select(SHAPES, this.spec.shape, this.onSelect('shape'), 'Graph shape')}</label>
        <label>lens ${this.select(LENSES, this.spec.lens, this.onSelect('lens'), 'Lens')}</label>
        <label>layer ${this.select(LAYERS, this.spec.layer, this.onSelect('layer'), 'Graph layer')}</label>
        <button class="act" @click=${() => this.navigate(randomSpec())}>randomize</button>
        <button class="act" @click=${() => this.navigate({ ...this.spec, widgets: [] })}>clear</button>
        <input class="link" readonly .value=${globalThis.location?.href ?? ''} aria-label="Permalink" />
      </div>
      <div class="controls">
        <div class="chips">
          ${WIDGETS.map(
            (w) => html`<button class="chip" data-on=${this.spec.widgets.includes(w.id)} @click=${() => this.toggleWidget(w.id)}>
              ${w.label}
            </button>`
          )}
        </div>
      </div>
    `;
  }

  private renderGrid(variant: Variant): TemplateResult {
    return html`
      <div
        class="grid"
        style="grid-template-columns:${variant.columns};grid-template-rows:${variant.rows};grid-template-areas:${variant.areas}"
      >
        ${Object.keys(variant.regions).map(
          (area) => html`<section data-area=${area} style="grid-area:${area}"></section>`
        )}
      </div>
    `;
  }

  private renderNav(variantId?: string): TemplateResult {
    if (this.compose) {
      return html`<nav>
        <a href="./">menu</a>
        <a href="?v=${VARIANTS[0]?.id ?? ''}">presets</a>
      </nav>`;
    }
    const ids = VARIANTS.map((x) => x.id);
    const index = variantId ? ids.indexOf(variantId) : -1;
    const prev = index > 0 ? ids[index - 1] : undefined;
    const next = index >= 0 && index < ids.length - 1 ? ids[index + 1] : undefined;
    return html`<nav>
      ${prev ? html`<a href="?v=${prev}">‹ prev</a>` : ''}
      ${next ? html`<a href="?v=${next}">next ›</a>` : ''}
      <a href="./">all (${VARIANTS.length})</a>
    </nav>`;
  }

  private renderIndex(): TemplateResult {
    return html`
      <div class="leadv">
        <h1>SeNARS UI Lab</h1>
        <p>
          One substrate; many widget compositions. Browse the ${VARIANTS.length} presets, or compose
          your own from ${WIDGETS.length} widgets — every point is a shareable page.
        </p>
      </div>
      <div class="index">
        <a class="card accent" href="?compose=1">
          <h3>Composer →</h3>
          <p>Pick widgets, layout, graph mode/shape, lens and layer. Randomize to sample the space.</p>
        </a>
        ${VARIANTS.map(
          (x) => html`<a class="card" href="?v=${x.id}">
            <h3>${x.name}</h3>
            <p>${x.blurb}</p>
          </a>`
        )}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const variant = this.activeVariant();
    if (!variant) {
      return html`
        <header class="lab">
          <span class="wordmark">SeNARS <span>UI Lab</span></span>
          ${this.renderNav()}
        </header>
        ${this.renderIndex()}
      `;
    }
    return html`
      <header class="lab">
        <span class="wordmark">SeNARS <span>UI Lab</span></span>
        <span class="variant-name">${variant.name}</span>
        <span class="variant-blurb">${variant.blurb}</span>
        ${this.renderNav(variant.id)}
      </header>
      ${this.compose ? this.renderControls() : nothing}
      ${this.renderGrid(variant)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-surface': LabSurface;
  }
}
