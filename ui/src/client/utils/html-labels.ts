import type { Core } from 'cytoscape';
import { getLoDTier, showsHtmlBody } from './graph-scaling.js';

export interface HtmlLabelData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The LoD tier for this label. */
  tier: 'card' | 'full';
}

export function computeHtmlLabels(cy: Core): Map<string, HtmlLabelData> {
  const labels = new Map<string, HtmlLabelData>();

  cy.nodes('.workspace.html-enabled').forEach((node) => {
    const importance = Number(node.data('priority') ?? 0.5);
    const tier = getLoDTier(cy.zoom(), importance, true) as 'card' | 'full' | 'label' | 'glyph';

    if (!showsHtmlBody(cy.zoom(), importance, true)) return;

    const pos = node.renderedPosition();
    const w = node.renderedOuterWidth();
    const h = node.renderedOuterHeight();
    labels.set(node.id(), {
      id: node.id(),
      x: pos.x - w / 2,
      y: pos.y - h / 2,
      width: w,
      height: h,
      tier: tier === 'full' ? 'full' : 'card',
    });
  });
  return labels;
}
