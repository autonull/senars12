/**
 * ComposerControls — the contextual control strip for a composition.
 *
 * Renders only the controls relevant to the surfaces present: layout always, the
 * global graph controls iff the composition contains a graph surface. Emits a
 * new `Composition` on every change (`composition-change`); it never mutates the
 * URL or atoms itself, so the same strip drives the Studio and the Lab.
 */

import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { LAYOUT_IDS } from '../../framework/layout.js';
import type { Cell, Composition, Globals, LayoutId } from '../../framework/composition.js';
import { FILTER_ALL } from './config-sync.js';
import { LENS_FACETS } from '../../utils/lens-catalog.js';
import { GRAPH_LAYER_FACETS } from '../../core/graph-layer-defs.js';
import { FILTER_FACETS } from '../../core/filter-facets.js';
import { VIEWPORT_MODES } from '../../kernel/index.js';
import './toolbar-select.js';

/** A surface a composer can place: its registry id and a human label. */
export interface ComposerSurface {
  readonly id: string;
  readonly label: string;
}

/** Surfaces whose presence turns on the global graph controls. */
const GRAPH_SURFACES = new Set(['graph-surface', 'explore-surface', 'goals-surface', 'hud-surface']);

const labels = (defs: { ids: readonly string[]; get(id: string): { label: string } | undefined }) =>
  defs.ids.map((id) => ({ value: id, label: defs.get(id)?.label ?? id }));

const LAYOUT_OPTIONS = LAYOUT_IDS.map((id) => ({ value: id, label: id.toUpperCase() }));
const LENS_OPTIONS = labels(LENS_FACETS);
const LAYER_OPTIONS = labels(GRAPH_LAYER_FACETS);
const FILTER_OPTIONS = labels(FILTER_FACETS);
const SHAPE_OPTIONS = [
  { value: 'graph', label: 'Graph' },
  { value: 'table', label: 'Table' },
];
const MODE_OPTIONS = VIEWPORT_MODES.map((m) => ({ value: m, label: m.toUpperCase() }));
const FIT_OPTIONS = [
  { value: 'legible', label: 'Legible' },
  { value: 'fit', label: 'Fit' },
];

/** True when a composition needs the global graph controls. */
export const hasGraphSurface = (composition: Composition | undefined): boolean =>
  !!composition?.cells.some((cell) => 'surface' in cell && GRAPH_SURFACES.has(cell.surface));

@customElement('composer-controls')
export class ComposerControls extends BaseComponent {
  static override styles = css`
    :host {
      display: contents;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      border: 1px solid var(--colors-semantic-border-subtle);
      background: transparent;
      color: var(--colors-semantic-text-secondary);
      border-radius: 999px;
      padding: 3px 9px;
      font: inherit;
      cursor: pointer;
    }
    .chip[data-on='true'] {
      background: var(--colors-semantic-accent-cyan, #4cc9f0);
      color: #04121a;
      border-color: transparent;
    }
    .chip:hover {
      border-color: var(--colors-semantic-accent-cyan, #4cc9f0);
    }
    button.act {
      border: 1px solid var(--colors-semantic-accent-cyan, #4cc9f0);
      background: transparent;
      color: var(--colors-semantic-accent-cyan, #4cc9f0);
      border-radius: 999px;
      padding: 4px 12px;
      font: inherit;
      cursor: pointer;
    }
    button.act:hover {
      background: var(--colors-semantic-accent-cyan, #4cc9f0);
      color: #04121a;
    }
  `;

  @property({ type: Object }) composition?: Composition;
  @property({ type: Array }) surfaces: readonly ComposerSurface[] = [];
  @property({ type: Boolean }) showActions = false;

  private emit(composition: Composition): void {
    this.dispatchEvent(
      new CustomEvent<Composition>('composition-change', {
        detail: composition,
        bubbles: true,
        composed: true,
      })
    );
  }

  private setGlobals(patch: Partial<Globals>): void {
    const composition = this.composition;
    if (!composition) return;
    this.emit({ ...composition, globals: { ...composition.globals, ...patch } });
  }

  private onLayout = (e: CustomEvent<{ value: string }>): void => {
    if (this.composition) this.emit({ ...this.composition, layout: e.detail.value as LayoutId });
  };

  private toggleSurface = (id: string): void => {
    const composition = this.composition;
    if (!composition) return;
    const present = composition.cells.some((c) => 'surface' in c && c.surface === id);
    const cells: Cell[] = present
      ? composition.cells.filter((c) => !('surface' in c) || c.surface !== id)
      : [...composition.cells, { surface: id }];
    this.emit({ ...composition, cells });
  };

  private randomize = (): void => {
    const composition = this.composition;
    const pool = [...this.surfaces];
    if (!composition || pool.length === 0) return;
    const count = 1 + Math.floor(Math.random() * Math.min(4, pool.length));
    const cells: Cell[] = [];
    while (cells.length < count && pool.length) {
      const [surface] = pool.splice(Math.floor(Math.random() * pool.length), 1);
      if (surface) cells.push({ surface: surface.id });
    }
    this.emit({ ...composition, cells });
  };

  private select(
    label: string,
    value: string,
    options: readonly { value: string; label: string }[],
    on: (e: CustomEvent<{ value: string }>) => void
  ): TemplateResult {
    return html`
      <toolbar-select
        .selectLabel=${label}
        .selectedValue=${value}
        .options=${options}
        .selectAriaLabel=${label}
        @change=${on}
      ></toolbar-select>
    `;
  }

  protected override render(): TemplateResult {
    const composition = this.composition;
    if (!composition) return html`${nothing}`;
    const globals = composition.globals ?? {};
    const graph = hasGraphSurface(composition);
    return html`
      <div class="controls">
        ${this.select('Layout', composition.layout, LAYOUT_OPTIONS, this.onLayout)}
        ${graph
          ? html`
              ${this.select('Lens', globals.lens ?? 'belief', LENS_OPTIONS, (e) =>
                this.setGlobals({ lens: e.detail.value })
              )}
              ${this.select('Layer', globals.layer ?? 'both', LAYER_OPTIONS, (e) =>
                this.setGlobals({ layer: e.detail.value })
              )}
              ${this.select('Shape', globals.shape ?? 'graph', SHAPE_OPTIONS, (e) =>
                this.setGlobals({ shape: e.detail.value as Globals['shape'] })
              )}
              ${this.select('Mode', globals.mode ?? '2d', MODE_OPTIONS, (e) =>
                this.setGlobals({ mode: e.detail.value as Globals['mode'] })
              )}
              ${this.select('Fit', globals.fit ?? 'legible', FIT_OPTIONS, (e) =>
                this.setGlobals({ fit: e.detail.value as Globals['fit'] })
              )}
              ${this.select('Filter', globals.filter ?? FILTER_ALL, FILTER_OPTIONS, (e) =>
                this.setGlobals({ filter: e.detail.value })
              )}
            `
          : nothing}
        ${this.showActions
          ? html`
              <button class="act" @click=${this.randomize}>randomize</button>
              <button class="act" @click=${() => this.emit({ ...composition, cells: [] })}>
                clear
              </button>
            `
          : nothing}
      </div>
      ${this.surfaces.length
        ? html`
            <div class="controls">
              <div class="chips">
                ${this.surfaces.map(
                  (surface) => html`
                    <button
                      class="chip"
                      data-on=${composition.cells.some((c) => 'surface' in c && c.surface === surface.id)}
                      @click=${() => this.toggleSurface(surface.id)}
                    >
                      ${surface.label}
                    </button>
                  `
                )}
              </div>
            </div>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'composer-controls': ComposerControls;
  }
}
