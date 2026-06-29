import type { Core } from 'cytoscape';

export interface HtmlLabelData {
  id: string;
  html: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeHtmlLabels(cy: Core): Map<string, HtmlLabelData> {
  const labels = new Map<string, HtmlLabelData>();
  if (cy.zoom() < 1.0) return labels;

  cy.nodes('.html-enabled').forEach((node) => {
    const html = node.data('html');
    if (!html) return;
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
