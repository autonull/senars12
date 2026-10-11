import cytoscape from 'cytoscape';
import { describe, expect, it } from 'vitest';
import { HTML_BODY_BUDGET } from '../../src/client/utils/graph-scaling.js';
import { computeHtmlLabels } from '../../src/client/utils/html-labels.js';

/** A headless graph of `count` workspace nodes, all eligible at a full-tier zoom. */
const workspaceCore = (count: number) =>
  cytoscape({
    headless: true,
    styleEnabled: true,
    style: [{ selector: 'node', style: { width: 20, height: 20 } }],
    elements: Array.from({ length: count }, (_, index) => ({
      data: { id: `n${index}`, priority: (index % 10) / 10 },
      classes: 'workspace html-enabled',
    })),
  });

describe('computeHtmlLabels against a real Core (§Move 2.2)', () => {
  it('mounts no more than the budget and reports the held-back remainder', () => {
    const core = workspaceCore(HTML_BODY_BUDGET + 7);
    core.zoom(2);
    const { labels, hidden } = computeHtmlLabels(core);
    expect(labels.size).toBe(HTML_BODY_BUDGET);
    expect(hidden).toBe(7);
    expect(labels.size + hidden).toBe(core.nodes().length);
  });

  it('mounts everything when the graph is under budget', () => {
    const core = workspaceCore(3);
    core.zoom(2);
    const { labels, hidden } = computeHtmlLabels(core);
    expect(labels.size).toBe(3);
    expect(hidden).toBe(0);
  });

  it('carries rendered geometry and a tier for each mounted body', () => {
    const core = workspaceCore(1);
    core.zoom(2);
    const { labels } = computeHtmlLabels(core);
    const label = labels.get('n0');
    expect(label).toBeDefined();
    expect(label?.width).toBeGreaterThan(0);
    expect(label?.height).toBeGreaterThan(0);
    expect(['card', 'full']).toContain(label?.tier);
  });
});
