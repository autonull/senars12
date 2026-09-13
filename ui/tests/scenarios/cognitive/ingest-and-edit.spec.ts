import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Cognitive Gate: ingest and edit', () => {
  test('type a sentence, see a node appear', async ({ page, testApi }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();

    await expect(async () => {
      const state = await testApi.getConnectionState();
      expect(state).toBe('connected');
    }).toPass({ timeout: 10000 });

    // Send Narsese directly to create a concept with truth value
    const textarea = page.locator('input-hud textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('<sky --> blue>. :|:');

    // Click send
    const sendBtn = page.locator('input-hud .send-btn');
    await sendBtn.click();

    // Wait for the node to appear
    await expect(async () => {
      const ids = await testApi.getAllNodeIds();
      expect(ids.length).toBeGreaterThan(0);
    }).toPass({ timeout: 15000 });

    // Verify graph has nodes
    const ids = await testApi.getAllNodeIds();
    expect(ids.length).toBeGreaterThan(0);
  });
});
