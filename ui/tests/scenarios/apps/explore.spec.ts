import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnectedDirect } from '../../framework/utils/interactions';

test.describe.configure({ retries: 0 });

/**
 * Explore is a composition app: the shell supplies the chrome and the graph
 * controls (its surface renders a graph), and the surface is chromeless.
 */
test('explore app loads under the shell with graph controls @app @explore', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/explore/');
  await waitConnectedDirect(page);

  await expect(page.locator('s-app-shell')).toBeVisible();
  await expect(page.locator('explore-surface')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('app-chrome')).toContainText('Explore');
  await expect(page.locator('app-chrome .status')).toContainText('connected');

  // Graph controls are contextual: present because the surface renders a graph.
  await expect(page.locator('composer-controls select[aria-label="Lens"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('composer-controls select[aria-label="Layer"]')).toBeVisible();
  await expect(page.locator('composer-controls select[aria-label="Mode"]')).toBeVisible();
});
