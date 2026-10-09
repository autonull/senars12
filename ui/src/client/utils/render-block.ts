/**
 * The one rendering of a block's **body** (§1.4/§2.4) — the part a block is made
 * of, without any host's chrome. The Notebook renders blocks in its reading
 * column; the graph hover popover renders the *same* body as a card, so a
 * preview and the block it stands for cannot drift apart and an artifact view is
 * never re-implemented per surface.
 *
 * Lit nodes only: an engine term is untrusted text, so it is escaped by
 * construction and there is no `innerHTML` sink on this path.
 */

import { css, html, nothing, type TemplateResult } from 'lit';
import { artifactViewSpec } from '../core/artifacts.js';
import { payloadOf, type TableData } from '../core/block-payload.js';
import { resolveSource, type Source } from '../core/citations.js';
import { tokenizeInline } from '../core/inline-text.js';
import type { ViewSpec } from '../core/view-spec.js';
import type { SemanticBlock } from '../core/workspace-graph.js';

/** Styles for the body markup below; compose into any host that renders a body. */
export const blockBodyStyles = css`
  .text { color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-base); line-height: var(--typography-lineHeights-relaxed); white-space: pre-wrap; word-break: break-word; }
  .heading { margin: 0; color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); }
  .code { margin: 0; padding: var(--spacing-scale-3); border-radius: 6px; background: var(--colors-semantic-bg-base); overflow: auto; }
  .code code { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); }
  .image { max-width: 100%; border-radius: 6px; }
  .citation { color: var(--colors-semantic-accent-cyan); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-sm); text-decoration: none; }
  .citation:hover { text-decoration: underline; }
  .cite-index { color: var(--colors-semantic-text-muted); }
  .cite-ref { color: var(--colors-semantic-accent-cyan); text-decoration: none; }
  .cite-ref:hover { text-decoration: underline; }
  .list { margin: 0; padding-left: var(--spacing-scale-4); color: var(--colors-semantic-text-primary); font-size: var(--typography-scale-base); line-height: var(--typography-lineHeights-relaxed); }
  table.data { border-collapse: collapse; width: 100%; font-size: var(--typography-scale-sm); color: var(--colors-semantic-text-primary); }
  table.data th, table.data td { border: 1px solid var(--colors-semantic-border-subtle); padding: var(--spacing-scale-1) var(--spacing-scale-2); text-align: left; }
  table.data th { color: var(--colors-semantic-text-secondary); font-weight: var(--typography-fontWeights-medium); }
`;

const view = (spec: ViewSpec): TemplateResult =>
  html`<s-view .spec=${spec} .chrome=${false} .budget=${'embedded'}></s-view>`;

const renderTable = (data: TableData): TemplateResult => html`
  <table class="data">
    <thead><tr>${data.headers.map((cell) => html`<th>${cell}</th>`)}</tr></thead>
    <tbody>
      ${data.rows.map((row) => html`<tr>${row.map((cell) => html`<td>${cell}</td>`)}</tr>`)}
    </tbody>
  </table>
`;

/** The inline Markdown subset as Lit nodes — no `innerHTML`, so text is escaped by construction. */
function renderInline(text: string, sources: readonly Source[]): unknown[] {
  return tokenizeInline(text).map((token) => {
    switch (token.type) {
      case 'code':
        return html`<code>${token.value}</code>`;
      case 'strong':
        return html`<strong>${token.value}</strong>`;
      case 'em':
        return html`<em>${token.value}</em>`;
      case 'link':
        return html`<a href=${token.href} target="_blank" rel="noreferrer">${token.value}</a>`;
      case 'citation': {
        const source = resolveSource(token.key, sources);
        return source
          ? html`<a
              class="cite-ref"
              href=${source.href}
              target="_blank"
              rel="noreferrer"
              title=${source.label ?? source.href}
              >[${token.key}]</a
            >`
          : `[${token.key}]`;
      }
      default:
        return token.value;
    }
  });
}

function renderHeading(block: SemanticBlock, sources: readonly Source[]): TemplateResult {
  const body = renderInline(block.text ?? block.title ?? '', sources);
  switch (Math.min(Math.max(block.level ?? 2, 1), 6)) {
    case 1:
      return html`<h1 class="heading">${body}</h1>`;
    case 2:
      return html`<h2 class="heading">${body}</h2>`;
    case 3:
      return html`<h3 class="heading">${body}</h3>`;
    case 4:
      return html`<h4 class="heading">${body}</h4>`;
    case 5:
      return html`<h5 class="heading">${body}</h5>`;
    default:
      return html`<h6 class="heading">${body}</h6>`;
  }
}

/**
 * A block's body: its artifact through the view contract when it declares a spec,
 * the typed payload otherwise, and inline text as the fallback. `sources` is the
 * bibliography inline `[n]` references and citation entries resolve against.
 */
export function renderBlockBody(
  block: SemanticBlock,
  sources: readonly Source[]
): TemplateResult | typeof nothing {
  if (block.kind === 'heading') return renderHeading(block, sources);
  if (block.kind === 'image' && block.data) {
    const image = payloadOf(block.data, 'image');
    if (image)
      return html`<img
        class="image"
        src=${image.src}
        alt=${image.alt}
        loading="lazy"
        width=${image.width ?? nothing}
        height=${image.height ?? nothing}
      />`;
  }
  if (block.kind === 'citation' && block.data) {
    const citation = payloadOf(block.data, 'citation');
    if (citation) {
      const source = citation.key ? resolveSource(citation.key, sources) : undefined;
      return html`<a class="citation" href=${citation.href} target="_blank" rel="noreferrer"
        >${source ? html`<span class="cite-index">[${source.index}]</span> ` : ''}${
          citation.label ?? citation.key ?? citation.href
        }</a
      >`;
    }
  }
  if (block.kind === 'code') {
    const spec = artifactViewSpec(block);
    return spec ? view(spec) : html`<pre class="code"><code>${block.text}</code></pre>`;
  }
  if (block.kind === 'table' && block.data) {
    const spec = artifactViewSpec(block);
    if (spec) return view(spec);
    const data = payloadOf(block.data, 'table');
    if (data) return renderTable(data);
  }
  if (block.kind === 'config-change') {
    const spec = artifactViewSpec(block);
    if (spec) return view(spec);
  }
  if (block.kind === 'list' && block.data) {
    const items = payloadOf(block.data, 'list')?.items;
    if (items)
      return html`<ul class="list">
        ${items.map((item) => html`<li>${renderInline(item, sources)}</li>`)}
      </ul>`;
  }
  return block.text ? html`<div class="text">${renderInline(block.text, sources)}</div>` : nothing;
}
