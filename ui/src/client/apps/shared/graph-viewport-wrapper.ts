/**
 * GraphViewportWrapper — standardized <graph-viewport> integration.
 *
 * Handles filter/mode props, resize observation, and consistent styling.
 */
import { css, html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { type ViewportMode } from '../../core/store.js';
import '../../components/graph-viewport.js';

export interface GraphFilter {
  mode?: string;
  layer?: string;
  shape?: string;
}

export interface GraphViewportWrapperConfig {
  filter?: GraphFilter;
  mode?: ViewportMode;
  wrapperClass?: string;
  wrapperStyle?: string;
}

@customElement('graph-viewport-wrapper')
export class GraphViewportWrapper extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    graph-viewport {
      width: 100%;
      height: 100%;
    }
  `;

  @property({ type: Object }) filter?: GraphFilter;
  @property({ type: String }) mode?: ViewportMode;
  @property({ type: String }) wrapperClass = '';
  @property({ type: String }) wrapperStyle = '';

  @state() private wrapperKey = 0;

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('filter') || changed.has('mode')) {
      this.wrapperKey++;
    }
  }

  protected override render() {
    return html`
      <graph-viewport
        .key=${this.wrapperKey}
        .filter=${this.filter}
        .mode=${this.mode}
        class=${this.wrapperClass}
        style=${this.wrapperStyle}
      ></graph-viewport>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'graph-viewport-wrapper': GraphViewportWrapper;
  }
}