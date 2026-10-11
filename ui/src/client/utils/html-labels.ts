import type { Core } from 'cytoscape';
import { getLoDTier, HTML_BODY_BUDGET, showsHtmlBody } from './graph-scaling.js';

export interface HtmlLabelData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The LoD tier for this label. */
  tier: 'card' | 'full';
}

/** One node that could mount an HTML body, ranked against the others. */
export interface HtmlLabelCandidate {
  id: string;
  importance: number;
  /** Rendered area (px²) — the tie-breaker so the larger node keeps its body. */
  area: number;
}

/**
 * The ids that earn an HTML body, capped at `budget` (§Move 2.2). Most important
 * first, then the largest, then by id, so a dense graph mounts a bounded number
 * of `<s-node-body>` elements and the rest fall back to their card/label tier.
 * Deterministic: the same graph always selects the same bodies.
 */
export function selectHtmlLabels(
  candidates: readonly HtmlLabelCandidate[],
  budget: number = HTML_BODY_BUDGET
): string[] {
  return [...candidates]
    .sort(
      (a, b) => b.importance - a.importance || b.area - a.area || a.id.localeCompare(b.id)
    )
    .slice(0, Math.max(0, Math.floor(budget)))
    .map((candidate) => candidate.id);
}

export function computeHtmlLabels(cy: Core, budget: number = HTML_BODY_BUDGET): Map<string, HtmlLabelData> {
  const candidates: HtmlLabelCandidate[] = [];
  const geometry = new Map<string, { x: number; y: number; width: number; height: number; tier: 'card' | 'full' }>();

  cy.nodes('.workspace.html-enabled').forEach((node) => {
    const importance = Number(node.data('priority') ?? 0.5);
    if (!showsHtmlBody(cy.zoom(), importance, true)) return;
    const tier = getLoDTier(cy.zoom(), importance, true) as 'card' | 'full' | 'label' | 'glyph';
    const pos = node.renderedPosition();
    const width = node.renderedOuterWidth();
    const height = node.renderedOuterHeight();
    candidates.push({ id: node.id(), importance, area: width * height });
    geometry.set(node.id(), {
      x: pos.x - width / 2,
      y: pos.y - height / 2,
      width,
      height,
      tier: tier === 'full' ? 'full' : 'card',
    });
  });

  const labels = new Map<string, HtmlLabelData>();
  for (const id of selectHtmlLabels(candidates, budget)) {
    const box = geometry.get(id);
    if (box) labels.set(id, { id, ...box });
  }
  return labels;
}
