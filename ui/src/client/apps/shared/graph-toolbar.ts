/**
 * GraphToolbar — composite toolbar for lens/layer/filter/mode/aspect controls.
 *
 * Used by apps that need standard graph controls.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import {
  $activeLens,
  $activeRenderer,
  $aspect,
  $graphLayer,
  setActiveRenderer,
  setAspect,
} from '../../kernel/index.js';
import { LENS_FACETS } from '../../utils/lens-catalog.js';
import { GRAPH_LAYER_FACETS } from '../../core/graph-layer-defs.js';
import { FILTER_FACETS } from '../../core/filter-facets.js';
import { ASPECTS, ASPECT_LABELS, ASPECT_ICONS } from '../../framework/coordinates.js';
import './toolbar-select.js';

export interface GraphToolbarConfig {
  showLens?: boolean;
  showLayer?: boolean;
  showShape?: boolean;
  showMode?: boolean;
  showFilter?: boolean;
  showAspect?: boolean;
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
  @property({ type: Boolean }) showAspect = true;
  @property({ type: String }) defaultLens = 'belief';
  @property({ type: String }) defaultLayer = 'both';

  @state() private activeLens = 'belief';
  @state() private activeLayer = 'both';
  @state() private activeRenderer = 'graph-2d';
  @state() private activeFilter = 'all';
  @state() private activeAspect = 'content';

  private get activeShape(): 'graph' | 'table' {
    return this.activeRenderer === 'notebook' ? 'table' : 'graph';
  }

  private get activeMode(): '2d' | '3d' {
    return this.activeRenderer === 'graph-3d' ? '3d' : '2d';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.watchWith($activeLens, (v) => (this.activeLens = v));
    this.watchWith($activeRenderer, (v) => (this.activeRenderer = v));
    this.watchWith($graphLayer, (v) => (this.activeLayer = v));
    this.watchWith($aspect, (v) => (this.activeAspect = v));
    this.activeLens = $activeLens.get();
    this.activeRenderer = $activeRenderer.get();
    this.activeLayer = $graphLayer.get();
    this.activeAspect = $aspect.get();
  }

  private handleLensChange = (e: CustomEvent): void => {
    $activeLens.set(e.detail.value);
  };

  private handleLayerChange = (e: CustomEvent): void => {
    $graphLayer.set(e.detail.value);
  };

  private handleShapeChange = (e: CustomEvent): void => {
    const shape = e.detail.value as 'graph' | 'table';
    const renderer = shape === 'table' ? 'notebook' : 'graph-2d';
    setActiveRenderer(renderer);
  };

  private handleModeChange = (e: CustomEvent): void => {
    const mode = e.detail.value as '2d' | '3d';
    const renderer = mode === '3d' ? 'graph-3d' : 'graph-2d';
    setActiveRenderer(renderer);
  };

  private handleFilterChange = (e: CustomEvent): void => {
    this.activeFilter = e.detail.value;
    this.dispatchEvent(new CustomEvent('filter-change', { detail: { value: e.detail.value }, bubbles: true }));
  };

  private handleAspectChange = (e: CustomEvent): void => {
    setAspect(e.detail.value);
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

  private modeOptions = [
    { value: '2d', label: '2D' },
    { value: '3d', label: '3D' },
  ];

  private filterOptions = FILTER_FACETS.ids.map((id) => {
    const facet = FILTER_FACETS.get(id);
    return { value: id, label: facet!.label };
  });

  private aspectOptions = ASPECTS.map((aspect) => ({
    value: aspect,
    label: ASPECT_LABELS[aspect],
  }));

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
      ${this.showAspect ? html`
        <div class="toolbar-group">
          <toolbar-select
            .selectLabel=${'Aspect'}
            .selectedValue=${this.activeAspect}
            .options=${this.aspectOptions}
            .selectAriaLabel=${'Focus aspect'}
            @change=${this.handleAspectChange}
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

