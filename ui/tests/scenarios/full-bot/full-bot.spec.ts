import { expect, test } from '../../framework/fixtures/senars-app';

test('full bot: page loads, WS connects, and graph viewport renders', async ({ testApi, page }) => {
  await expect(page.locator('graph-viewport')).toBeVisible();
  await expect(page.locator('input-hud')).toBeVisible();

  await expect(async () => {
    const state = await testApi.getConnectionState();
    expect(state).toBe('connected');
  }).toPass({ timeout: 10000 });

  // Verify config.schema was received with NAR fields (flat keys format)
  await expect(async () => {
    const storeState = await testApi.getStoreState('config');
    if (!storeState) return;
    const config = JSON.parse(storeState);
    expect(Object.hasOwn(config, 'nars.maxConcepts')).toBe(true);
    expect(Object.hasOwn(config, 'nars.activationDecayRate')).toBe(true);
  }).toPass({ timeout: 5000 });
});
