import { test, expect } from '../../framework/fixtures/senars-app';

test('app loads without errors and connects to WebSocket', async ({
  chat, config, graph, telemetry, testApi, page,
}) => {
  await expect(page.locator('chat-console')).toBeVisible();
  await expect(page.locator('belief-graph')).toBeVisible();

  await expect(async () => {
    const state = await testApi.getConnectionState();
    expect(state).toBe('connected');
  }).toPass({ timeout: 10000 });

  // Gear icon opens config drawer (full mode requires 5 messages)
  for (let i = 0; i < 5; i++) {
    await page.locator('chat-console').locator('input').fill(`test ${i}`);
    await page.locator('chat-console').locator('button:has-text("SEND")').click();
    await page.waitForTimeout(100);
  }
  await page.locator('.gear-btn').first().click();
  await expect(page.locator('config-drawer')).toBeVisible();
});