/**
 * CompositionView — renders a Composition into a CSS grid of dumb surfaces.
 *
 * The only grid-rendering code in the product: the shell, the Studio and the Lab
 * all mount arrangements through here. Cells are mounted imperatively so surface
 * elements keep their state across re-renders; a cell that is itself a
 * composition recurses (a nested `<composition-view>`), which is how variety is
 * unbounded without new components.
 */

import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { areaName, layoutOf } from '../framework/layout.js';
import { surfaceFor, surfaceTag } from '../framework/surface.js';
import type { Cell, Composition } from '../framework/composition.js';

/** The custom-element tag for a cell's surface id (falls back to the id as a tag). */
export const cellTag = (surfaceId: string): string => {
  const descriptor = surfaceFor(surfaceId);
  return descriptor ? surfaceTag(descriptor) : surfaceId;
};

@customElement('composition-view')
export class CompositionView extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .grid {
      display: grid;
      width: 100%;
      height: 100%;
      min-height: 0;
    }
    .cell {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .cell > * {
      flex: 1 1 auto;
      min-height: 0;
    }
  `;

  @property({ type: Object }) composition?: Composition;

  /** The composition object whose cells are currently mounted. */
  private mountedFor?: Composition;

  protected override updated(): void {
    const composition = this.composition;
    if (!composition || this.mountedFor === composition) return;
    this.mountedFor = composition;
    this.dataset.composition = composition.id;
    this.mountCells(composition);
  }

  private mountCells(composition: Composition): void {
    const grid = this.renderRoot.querySelector<HTMLElement>('.grid');
    if (!grid) return;
    composition.cells.forEach((cell, index) => {
      const slot = grid.querySelector<HTMLElement>(`[data-area="${areaName(index)}"]`);
      if (slot) slot.replaceChildren(this.createElementFor(cell));
    });
  }

  private createElementFor(cell: Cell): HTMLElement {
    if ('surface' in cell) return document.createElement(cellTag(cell.surface));
    const nested = document.createElement('composition-view') as CompositionView;
    nested.composition = cell.composition;
    return nested;
  }

  protected override render(): TemplateResult {
    const composition = this.composition;
    if (!composition) return html`${nothing}`;
    const { columns, rows, areas } = layoutOf(composition);
    return html`
      <div
        class="grid"
        style="grid-template-columns:${columns};grid-template-rows:${rows};grid-template-areas:${areas}"
      >
        ${composition.cells.map(
          (_cell, index) =>
            html`<section
              class="cell"
              data-area=${areaName(index)}
              style="grid-area:${areaName(index)}"
            ></section>`
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'composition-view': CompositionView;
  }
}
