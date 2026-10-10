import type { Core } from 'cytoscape';
import { htmlLabelVisible } from './graph-scaling.js';

export interface HtmlLabelData {
  id: string;
  /** Legacy string HTML; absent for workspace blocks, which render via `<s-node-body>`. */
  html?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeHtmlLabels(cy: Core): Map<string, HtmlLabelData> {
  const labels = new Map<string, HtmlLabelData>();
  if (!htmlLabelVisible(cy.zoom())) return labels;

  cy.nodes('.html-enabled').forEach((node) => {
    const html = node.data('html') as string | undefined;
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
    });
  });
  return labels;
}
