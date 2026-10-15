/**
 * UI Lab — a menu of layout metaphors plus a generative composer.
 *
 * `?v=<id>`          a named preset (separate page).
 * `?compose=1&...`   a point in the parameter space, live and shareable.
 * (no params)        the menu.
 *
 * The Lab now reuses the shell chrome (app-chrome), the composer controls
 * (composer-controls), and the grid renderer (composition-view) — the same
 * components the Studio uses. The only Lab-specific code is the preset catalogue
 * and the menu/index page.
 */

import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $activeLens, $activeRenderer, $graphFit, $graphLayer, setActiveRenderer } from '../../kernel/index.js';
import { BaseComponent } from '../../core/base-component.js';
import { compositionFor, getCompositions, registerComposition, type Composition } from '../../framework/composition.js';
import { layoutOf } from '../../framework/layout.js';
import { registerLabPresets, LAB_PRESETS } from './presets.js';
import { parseSpec, specToSearch, randomSpec, type Spec, WIDGETS, LAYOUTS, MODES, SHAPES, LENSES, LAYERS, FIT_OPTIONS } from './compose.js';
import { applyGlobals, compositionFromUrl, compositionToSearch } from '../shared/config-sync.js';
import '../shared/app-chrome.js';
import '../shared/composer-controls.js';
import '../../components/composition-view.js';

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
    /* Composer controls slot styling */
    .composer-bar {
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-base);
      flex: 0 0 auto;
    }
    composition-view {
      flex: 1 1 auto;
      min-height: 0;
    }
  `;

  private readonly params = new URLSearchParams(globalThis.location?.search ?? '');
  @state() private variantId = this.params.get('v') ?? '';
  @state() private compose = this.params.has('compose');
  @state() private spec: Spec = parseSpec(this.params);
  @state() private composition?: Composition;
  private filledFor = '';

  override connectedCallback(): void {
    super.connectedCallback();
    registerLabPresets();
    this.resolveComposition();
    this.applyGlobals();
  }

  private resolveComposition(): void {
    if (this.compose) {
      // Composer mode: build a composition from the spec
      this.composition = this.specToComposition(this.spec);
    } else if (this.variantId) {
      // Preset mode: look up registered composition
      this.composition = compositionFor(this.variantId);
    }
  }

  private specToComposition(spec: Spec): Composition {
    const widgets = spec.widgets.map((id) => WIDGETS.find((w) => w.id === id)).filter((w): w is typeof WIDGETS[0] => !!w);
    const cells = widgets.map((w, i) => ({ surface: w.tag, area: `a${i}` })); // Use a, b, c... areas for composer
    return {
      id: 'compose',
      name: widgets.length ? widgets.map((w) => w.label).join(' · ') : 'Empty',
      layout: spec.layout,
      cells,
      globals: {
        lens: spec.lens,
        layer: spec.layer,
        shape: spec.shape,
        mode: spec.mode,
        fit: spec.fit,
      },
    };
  }

  private applyGlobals(): void {
    if (!this.composition) return;
    const globals = this.composition.globals ?? {};
    // Lab presets use 'fit' to show full graph; composer respects explicit fit
    $graphFit.set(this.compose ? (globals.fit ?? 'legible') : 'fit');
    // Source rule: viewportMode and graphShape are derived from activeRenderer
    const renderer = this.resolveRenderer(globals.mode, globals.shape);
    if (renderer) setActiveRenderer(renderer);
    if (globals.lens) $activeLens.set(globals.lens);
    if (globals.layer) $graphLayer.set(globals.layer as never);
  }

  private resolveRenderer(mode?: string, shape?: string): string | undefined {
    if (shape === 'table') return 'notebook';
    if (mode === '3d') return 'graph-3d';
    if (mode === '2d' || shape === 'graph') return 'graph-2d';
    return undefined;
  }

  private signature(): string {
    if (this.compose) return specToSearch(this.spec);
    return this.variantId;
  }

  override updated(): void {
    if (!this.composition || this.filledFor === this.signature()) return;
    this.filledFor = this.signature();
    this.applyGlobals();
  }

  private navigate(spec: Spec): void {
    this.spec = spec;
    globalThis.history?.replaceState(null, '', specToSearch(spec));
    this.composition = this.specToComposition(spec);
  }

  private onSelect(key: keyof Spec) {
    return (event: Event) => this.navigate({ ...this.spec, [key]: (event.target as HTMLSelectElement).value });
  }

  private toggleWidget = (id: string): void => {
    const has = this.spec.widgets.includes(id);
    const widgets = has ? this.spec.widgets.filter((x) => x !== id) : [...this.spec.widgets, id];
    this.navigate({ ...this.spec, widgets });
  };

  private renderNav(variantId?: string): TemplateResult {
    if (this.compose) {
      return html`<nav>
        <a href="./">menu</a>
        <a href="?v=${LAB_PRESETS[0]?.id ?? ''}">presets</a>
      </nav>`;
    }
    const ids = LAB_PRESETS.map((x) => x.id);
    const index = variantId ? ids.indexOf(variantId) : -1;
    const prev = index > 0 ? ids[index - 1] : undefined;
    const next = index >= 0 && index < ids.length - 1 ? ids[index + 1] : undefined;
    return html`<nav>
      ${prev ? html`<a href="?v=${prev}">‹ prev</a>` : ''}
      ${next ? html`<a href="?v=${next}">next ›</a>` : ''}
      <a href="./">all (${LAB_PRESETS.length})</a>
    </nav>`;
  }

  private renderIndex(): TemplateResult {
    return html`
      <div class="leadv">
        <h1>SeNARS UI Lab</h1>
        <p>
          One substrate; many widget compositions. Browse the ${LAB_PRESETS.length} presets, or compose
          your own from ${WIDGETS.length} widgets — every point is a shareable page.
        </p>
      </div>
      <div class="index">
        <a class="card accent" href="?compose=1">
          <h3>Composer →</h3>
          <p>Pick widgets, layout, graph mode/shape, lens and layer. Randomize to sample the space.</p>
        </a>
        ${LAB_PRESETS.map(
          (x) => html`<a class="card" href="?v=${x.id}">
            <h3>${x.name}</h3>
            <p>${x.blurb}</p>
          </a>`
        )}
      </div>
    `;
  }

  private renderComposerControls(): TemplateResult {
    if (!this.compose || !this.composition) return html`${nothing}`;
    const surfaces = WIDGETS.map((w) => ({ id: w.tag, label: w.label }));
    return html`
      <div class="composer-bar">
        <composer-controls
          .composition=${this.composition}
          .surfaces=${surfaces}
          .showActions=${true}
          @composition-change=${(e: CustomEvent<Composition>) => {
            this.spec = this.compositionToSpec(e.detail);
            globalThis.history?.replaceState(null, '', compositionToSearch(e.detail));
          }}
        ></composer-controls>
      </div>
    `;
  }

  private compositionToSpec(comp: Composition): Spec {
    const widgetMap = new Map(WIDGETS.map((w) => [w.tag, w.id]));
    const widgets = comp.cells
      .filter((c): c is { surface: string } => 'surface' in c)
      .map((c) => widgetMap.get(c.surface))
      .filter((id): id is string => !!id);
    return {
      layout: comp.layout,
      widgets,
      mode: comp.globals?.mode ?? '2d',
      shape: comp.globals?.shape ?? 'graph',
      lens: comp.globals?.lens ?? 'belief',
      layer: comp.globals?.layer ?? 'both',
      fit: comp.globals?.fit ?? 'legible',
    };
  }

  protected override render(): TemplateResult {
    if (!this.composition) {
      return html`
        <header class="lab">
          <span class="wordmark">SeNARS <span>UI Lab</span></span>
          ${this.renderNav()}
        </header>
        ${this.renderIndex()}
      `;
    }

    const { columns, rows, areas } = layoutOf(this.composition);
    const hasGraph = this.composition.cells.some(
      (c): c is { surface: string } => 'surface' in c && ['graph-surface', 'explore-surface', 'goals-surface', 'hud-surface'].includes(c.surface)
    );

    return html`
      <app-chrome
        wordmark="SeNARS"
        title="UI Lab"
        tagline=${this.composition.name}
      >
        <composer-controls
          slot="controls"
          .composition=${this.composition}
          .surfaces=${WIDGETS.map((w) => ({ id: w.tag, label: w.label }))}
          .showActions=${this.compose}
          @composition-change=${(e: CustomEvent<Composition>) => {
            if (this.compose) {
              this.spec = this.compositionToSpec(e.detail);
              globalThis.history?.replaceState(null, '', compositionToSearch(e.detail));
            }
          }}
        ></composer-controls>
      </app-chrome>
      <composition-view .composition=${this.composition}></composition-view>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-surface': LabSurface;
  }
}