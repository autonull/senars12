import { expect, test } from '../framework/fixtures/senars-app.js';
import { VISUAL_CELLS, type VisualContext } from './matrix.js';

/**
 * Renders every matrix cell through the real boot path, forces a deterministic
 * graph layout, and snapshots the page. Baselines live in `baselines/<project>/`;
 * the custom reporter turns the run into `visual-report.json` for the gallery.
 */
for (const cell of VISUAL_CELLS) {
  test(cell.id, { annotation: { type: 'group', description: cell.group } }, async ({ page, testControl }) => {
    if (cell.viewport) await page.setViewportSize(cell.viewport);

    // Isolation: force the baseline scenario, then load this cell's scenario.
    await testControl.resetAll();
    if (cell.scenario) await testControl.loadScenario(cell.scenario);

    await page.goto(`/${cell.hash ?? ''}`);
    await page.reload();

    const settle = async (layout?: string) => {
      // Ready when the active renderer has data: the graph renderer exposes a
      // cytoscape count, the notebook/3D renderers only the shared store.
      await page.waitForFunction(
        () => {
          const api = (window as Record<string, unknown>).__testApi as {
            graph?: { getNodeCount?: () => number };
            store?: { getState?: (path: string) => { size?: number } | undefined };
          };
          if (Number(api?.graph?.getNodeCount?.() ?? 0) > 0) return true;
          return Number(api?.store?.getState?.('graphNodes')?.size ?? 0) > 0;
        },
        { timeout: 15000 }
      );
      // Text metrics (and therefore node sizing / layout bounds) must not race
      // font loading, or the fit shifts between runs.
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        (name) =>
          (
            (window as Record<string, unknown>).__testApi as {
              graph?: { setLayout?: (n: string) => void };
            }
          )?.graph?.setLayout?.(name),
        layout ?? cell.layout ?? 'breadthfirst'
      );
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
      await page.waitForTimeout(500);
    };

    const ctx: VisualContext = { page, control: testControl, settle };
    await settle();
    // Freeze the engine before capture: the self-analyzer keeps deriving while a
    // test runs, so an unfrozen graph grows between runs and the snapshot drifts.
    await testControl.pause();
    await cell.prepare?.(ctx);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(`${cell.id}.png`, {
      mask: (cell.mask ?? []).map((selector) => page.locator(selector)),
      maskColor: '#12141a',
    });
  });
}
