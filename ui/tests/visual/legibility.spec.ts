import { expect, test } from '../framework/fixtures/senars-app.js';
import { LEGIBLE_NODE_PX, ZOOM } from '../../src/client/utils/graph-scaling.js';

type GraphProbe = {
  graph?: {
    getNodeCount?: () => number;
    setLayout?: (n: string) => void;
    getViewport?: () => { zoom: number } | null;
    getRenderedNodeSizes?: () => Array<{ id: string; size: number }>;
  };
};

/**
 * T.4 — the legibility assertion. The default graph view must read at rest: once
 * the default layout settles, the viewport cannot sit below the legible zoom
 * floor and no node may render below the legibility threshold. The visual cells
 * only imply this; here it is a failing assertion.
 */
test('default graph view is legible', async ({ page, testControl }) => {
  await testControl.resetAll();
  await testControl.pause();
  await page.goto('/#panels=none');
  await page.reload();

  await page.waitForFunction(
    () => Number((window as unknown as { __testApi?: GraphProbe }).__testApi?.graph?.getNodeCount?.() ?? 0) > 0,
    { timeout: 15000 }
  );
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    (window as unknown as { __testApi?: GraphProbe }).__testApi?.graph?.setLayout?.('breadthfirst')
  );
  await page.waitForTimeout(400);

  const { viewport, sizes } = await page.evaluate(() => {
    const graph = (window as unknown as { __testApi?: GraphProbe }).__testApi?.graph;
    return {
      viewport: graph?.getViewport?.() ?? null,
      sizes: graph?.getRenderedNodeSizes?.() ?? [],
    };
  });

  expect(viewport).not.toBeNull();
  expect(viewport?.zoom ?? 0).toBeGreaterThanOrEqual(ZOOM.min - 0.02);
  expect(sizes.length).toBeGreaterThan(0);
  for (const { id, size } of sizes) {
    expect(size, `node ${id} renders at ${size.toFixed(1)}px`).toBeGreaterThanOrEqual(
      LEGIBLE_NODE_PX - 0.5
    );
  }
});
