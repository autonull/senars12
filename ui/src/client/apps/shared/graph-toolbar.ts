/**
 * GraphToolbar — composite toolbar for lens/layer/filter/mode controls.
 *
 * Used by apps that need standard graph controls.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import {
  $activeLens,
  $graphLayer,
  $graphShape,
  $viewportMode,
  VIEWPORT_MODES,
} from '../../kernel/index.js';
import { LENS_FACETS } from '../../utils/lens-catalog.js';
import { GRAPH_LAYER_FACETS } from '../../core/graph-layer-defs.js';
import { FILTER_FACETS } from '../../core/filter-facets.js';
import './toolbar-select.js';

export interface GraphToolbarConfig {
  showLens?: boolean;
  showLayer?: boolean;
  showShape?: boolean;
  showMode?: boolean;
  showFilter?: boolean;
  defaultLens?: string;
  defaultLayer?: string;
}

@customElement('graph-toolbar')
export class GraphToolbar extends BaseComponent {
  static override styles = css`
    :host {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .toolbar-group {
      display: flex;
      gap: 4px;
      padding: 0 8px;
      border-left: 1px solid var(--colors-semantic-border-subtle);
    }
  `;

  @property({ type: Boolean }) showLens = true;
  @property({ type: Boolean }) showLayer = true;
  @property({ type: Boolean }) showShape = true;
  @property({ type: Boolean }) showMode = true;
  @property({ type: Boolean }) showFilter = true;
  @property({ type: String }) defaultLens = 'belief';
  @property({ type: String }) defaultLayer = 'both';

  @state() private activeLens = 'belief';
  @state() private activeLayer = 'both';
  @state() private activeShape = 'graph';
  @state() private activeMode = '2d';
  @state() private activeFilter = 'all';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watchWith($activeLens, (v) => (this.activeLens = v));
    this.watchWith($graphLayer, (v) => (this.activeLayer = v));
    this.watchWith($graphShape, (v) => (this.activeShape = v));
    this.watchWith($viewportMode, (v) => (this.activeMode = v));
    this.activeLens = $activeLens.get();
    this.activeLayer = $graphLayer.get();
    this.activeShape = $graphShape.get();
    this.activeMode = $viewportMode.get();
  }

  private handleLensChange = (e: CustomEvent): void => {
    $activeLens.set(e.detail.value);
  };

  private handleLayerChange = (e: CustomEvent): void => {
    $graphLayer.set(e.detail.value);
  };

  private handleShapeChange = (e: CustomEvent): void => {
    $graphShape.set(e.detail.value);
  };

  private handleModeChange = (e: CustomEvent): void => {
    $viewportMode.set(e.detail.value);
  };

  private handleFilterChange = (e: CustomEvent): void => {
    this.activeFilter = e.detail.value;
    this.dispatchEvent(new CustomEvent('filter-change', { detail: { value: e.detail.value }, bubbles: true }));
  };

  private lensOptions = LENS_FACETS.ids.map((id) => {
    const facet = LENS_FACETS.get(id);
    return { value: id, label: facet!.label };
  });

  private layerOptions = GRAPH_LAYER_FACETS.ids.map((id) => {
    const facet = GRAPH_LAYER_FACETS.get(id);
    return { value: id, label: facet!.label };
  });

  private shapeOptions = [
    { value: 'graph', label: 'Graph' },
    { value: 'table', label: 'Table' },
  ];

  private modeOptions = VIEWPORT_MODES.map((m) => ({ value: m, label: m.toUpperCase() }));

  private filterOptions = FILTER_FACETS.ids.map((id) => {
    const facet = FILTER_FACETS.get(id);
    return { value: id, label: facet!.label };
  });

  protected override render(): TemplateResult {
    return html`
      ${this.showLens ? html`
        <div class="toolbar-group">
          <toolbar-select
            .selectLabel=${'Lens'}
            .selectedValue=${this.activeLens}
            .options=${this.lensOptions}
            .selectAriaLabel=${'Graph lens'}
            @change=${this.handleLensChange}
          ></toolbar-select>
        </div>
      ` : nothing}
      ${this.showLayer ? html`
        <div class="toolbar-group">
          <toolbar-select
            .selectLabel=${'Layer'}
            .selectedValue=${this.activeLayer}
            .options=${this.layerOptions}
            .selectAriaLabel=${'Graph layer'}
            @change=${this.handleLayerChange}
          ></toolbar-select>
        </div>
      ` : nothing}
      ${this.showShape ? html`
        <div class="toolbar-group">
          <toolbar-select
            .selectLabel=${'Shape'}
            .selectedValue=${this.activeShape}
            .options=${this.shapeOptions}
            .selectAriaLabel=${'Graph shape'}
            @change=${this.handleShapeChange}
          ></toolbar-select>
        </div>
      ` : nothing}
      ${this.showMode ? html`
        <div class="toolbar-group">
          <toolbar-select
            .selectLabel=${'Mode'}
            .selectedValue=${this.activeMode}
            .options=${this.modeOptions}
            .selectAriaLabel=${'Graph mode'}
            @change=${this.handleModeChange}
          ></toolbar-select>
        </div>
      ` : nothing}
      ${this.showFilter ? html`
        <div class="toolbar-group">
          <toolbar-select
            .selectLabel=${'Filter'}
            .selectedValue=${this.activeFilter}
            .options=${this.filterOptions}
            .selectAriaLabel=${'Graph filter'}
            @change=${this.handleFilterChange}
          ></toolbar-select>
        </div>
      ` : nothing}
    `;
  }
}

