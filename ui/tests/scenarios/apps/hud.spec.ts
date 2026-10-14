import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnectedDirect } from '../../framework/utils/interactions';

test.describe.configure({ retries: 0 });

/**
 * HUD is a composition app: the shell owns the chrome and the graph controls,
 * while HUD's panels still mount through the shell's panel slot.
 */
test('hud app renders under the shell with panels and graph controls @app @hud', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/apps/hud/');
  await waitConnectedDirect(page);

  await expect(page.locator('s-app-shell')).toBeVisible();
  await expect(page.locator('hud-surface')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('app-chrome')).toContainText('HUD');
  await expect(page.locator('app-chrome .status')).toContainText('connected');

  // Graph controls are contextual (HUD renders a graph workspace).
  await expect(page.locator('composer-controls select[aria-label="Lens"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('composer-controls select[aria-label="Mode"]')).toBeVisible();
});
