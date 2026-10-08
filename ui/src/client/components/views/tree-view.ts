import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import type { TreeDataset, TreeNode } from '../../core/view-spec.js';

/** Renders a `TreeDataset` as nested lists — the provenance shape (§6.2). */
@customElement('s-tree')
export class TreeView extends BaseComponent {
  static override styles = css`
    :host { display: block; overflow: auto; }
    ul { list-style: none; margin: 0; padding-left: var(--spacing-scale-3); }
    :host > ul { padding-left: 0; }
    li > span { display: block; padding: 1px 0; font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); }
    .empty { padding: var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
  `;
  @property({ attribute: false }) data: TreeDataset | null = null;

  override render() {
    const roots = this.data?.roots ?? [];
    if (roots.length === 0) return html`<div class="empty">No nodes</div>`;
    return html`<ul class="tree">${roots.map((root) => this.node(root))}</ul>`;
  }

  private node(node: TreeNode): TemplateResult {
    return html`<li>
      <span>${node.label}</span>
      ${node.children?.length ? html`<ul>${node.children.map((child) => this.node(child))}</ul>` : nothing}
    </li>`;
  }
}

registerViewAdapter({
  shape: 'tree',
  tag: 's-tree',
  budgets: ['full', 'embedded'],
  interactions: ['select', 'link'],
});