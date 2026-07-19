import { expect, test } from '../../framework/fixtures/senars-app';

test('app loads without errors and connects to WebSocket', async ({ testApi, page }) => {
  await expect(page.locator('graph-viewport')).toBeVisible();
  await expect(page.locator('input-hud')).toBeVisible();

  await expect(async () => {
    const state = await testApi.getConnectionState();
    expect(state).toBe('connected');
  }).toPass({ timeout: 10000 });
});
