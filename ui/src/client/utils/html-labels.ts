import type { Core } from 'cytoscape';
import { htmlLabelVisible, getLoDTier, showsHtmlBody } from './graph-scaling.js';

export interface HtmlLabelData {
  id: string;
  /** Legacy string HTML; absent for workspace blocks, which render via `<s-node-body>`. */
  html?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The LoD tier for this label. */
  tier: 'card' | 'full';
}

export function computeHtmlLabels(cy: Core): Map<string, HtmlLabelData> {
  const labels = new Map<string, HtmlLabelData>();

  cy.nodes('.html-enabled').forEach((node) => {
    const html = node.data('html') as string | undefined;
    const importance = Number(node.data('priority') ?? 0.5);
    const isWorkspace = node.hasClass('workspace');
    const tier = getLoDTier(cy.zoom(), importance, isWorkspace) as 'card' | 'full' | 'label' | 'glyph';

    if (!showsHtmlBody(cy.zoom(), importance, isWorkspace)) return;

    const pos = node.renderedPosition();
    const w = node.renderedOuterWidth();
    const h = node.renderedOuterHeight();
    labels.set(node.id(), {
      id: node.id(),
      html,
      x: pos.x - w / 2,
      y: pos.y - h / 2,
      width: w,
      height: h,
      tier: tier === 'full' ? 'full' : 'card',
    });
  });
  return labels;
}
