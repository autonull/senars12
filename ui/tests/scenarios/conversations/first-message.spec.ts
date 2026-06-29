import { expect, test } from '../../framework/fixtures/senars-app';

test('app loads successfully', async ({ page, testApi }) => {
  await expect(page.locator('input-hud')).toBeVisible();
  await expect(async () => {
    const state = await testApi.getConnectionState();
    expect(state).toBe('connected');
  }).toPass({ timeout: 10000 });
});
