import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test('the LM status strip names the active provider @critical', async ({ page, testApi }) => {
  await waitConnected(testApi);
  const panel = page.locator('lm-status-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.panel')).toBeVisible();
  await expect(panel.locator('.dot')).toBeVisible();
  // Renders a provider line even when no LM is configured; real switching lands in Phase 9.2.
  await expect(panel.locator('.panel')).toContainText('LM:');
});