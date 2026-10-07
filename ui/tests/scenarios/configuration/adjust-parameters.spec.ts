import { expect, test } from '../../framework/fixtures/senars-app';
import { openPanels, waitConnected } from '../../framework/utils/interactions';

test('editing then resetting a config field clears its dirty state @critical', async ({
  page,
  testApi,
}) => {
  // Open only the config panel so the default telemetry panel cannot overlap it.
  await openPanels(page, ['config']);
  await testApi.ensureReady();
  await waitConnected(testApi);

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