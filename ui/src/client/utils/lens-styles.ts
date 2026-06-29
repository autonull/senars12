import type { Core } from 'cytoscape';
import { LENS_COLORS } from '../constants.js';

const BASE_FALLBACK_COLOR = '#00f3ff';

export function applyLensStyles(cy: Core, activeLens: string): void {
  cy.startBatch();
  cy.nodes().forEach((node) => {
    const ld = node.data('lensData');
    if (ld) {
      node.style({
        'background-color': ld.color,
        width: ld.size,
        height: ld.size,
        opacity: 0.3 + 0.7 * Math.min(1, ld.score),
        'transition-property': 'background-color, width, height, opacity',
        'transition-duration': '0.25s',
      });
    } else {
      node.style({
        'background-color': LENS_COLORS[activeLens] ?? BASE_FALLBACK_COLOR,
        opacity: 0.15,
        'transition-property': 'background-color, opacity',
        'transition-duration': '0.25s',
      });
    }
  });
  cy.edges().forEach((edge) => {
    const srcScore = edge.source().data('lensData')?.score ?? 0;
    edge.style('opacity', 0.05 + 0.9 * srcScore);
  });
  cy.endBatch();
}
