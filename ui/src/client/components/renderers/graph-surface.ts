/**
 * The Graph renderer's own surface (§3.1/§3.3): the table/2D/3D variants are
 * Graph-local chrome, not shell chrome. Keeping them here lets `WorkspaceHost`
 * mount one renderer element per mode without the shell knowing which tag a
 * graph is — the same discipline that keeps panels out of the shell.
 *
 * `spacegraph-viewport` is registered by the shell (`app-layout`), matching how
 * `s-view` is registered by the view barrel; this module only references the tag
 * so importing the Graph renderer never pulls the 3D/WebGPU stack.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { $graphShape, $viewportMode } from '../../core/store.js';
import { GRAPH_VIEW_SPEC } from '../views/graph-view-spec.js';
import '../graph-viewport.js';

@customElement('graph-surface')
export class GraphSurface extends BaseComponent {
  static override styles = css`
    :host { display: flex; flex: 1; min-height: 0; }
    graph-viewport, spacegraph-viewport, s-view { flex: 1; min-height: 0; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($graphShape);
    this.watch($viewportMode);
  }

  override render() {
    if ($graphShape.get() === 'table') {
      return html`<s-view budget="full" .chrome=${false} .spec=${GRAPH_VIEW_SPEC}></s-view>`;
    }
    if ($viewportMode.get() === '3d') return html`<spacegraph-viewport></spacegraph-viewport>`;
    return html`<graph-viewport></graph-viewport>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'graph-surface': GraphSurface;
  }
}
