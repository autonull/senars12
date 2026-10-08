import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test('editing then resetting a config field clears its dirty state @critical', async ({
  page,
  testApi,
}) => {
  await testApi.ensureReady();
  await waitConnected(testApi);

  // The config form lives in the settings overlay, not a standing panel.
  await page.locator('graph-toolbar button[title="Open settings dialog"]').click();

  const hud = page.locator('config-hud');
  await expect(hud).toBeVisible();

  const field = hud.locator('.field').first();
  await field.locator('input[type=range]').evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = input.max;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(field).toHaveClass(/dirty/);
  await expect(hud.locator('.dirty-indicator')).toBeVisible();

  await hud.locator('.reset-all button').click();
  await expect(hud.locator('.dirty-indicator')).toHaveCount(0);
});
