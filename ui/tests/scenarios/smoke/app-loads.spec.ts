import { test, expect } from '../../framework/fixtures/senars-app';

test('app loads without errors and connects to WebSocket', async ({
  chat, config, graph, telemetry, testApi, page,
}) => {
  await expect(page.locator('chat-console')).toBeVisible();
  await expect(page.locator('config-drawer')).toBeVisible();
  await expect(page.locator('telemetry-panel')).toBeVisible();

  await expect(async () => {
    const state = await testApi.getConnectionState();
    expect(state).toBe('connected');
  }).toPass({ timeout: 10000 });
});