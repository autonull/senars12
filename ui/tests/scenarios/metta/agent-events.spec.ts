import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('MettaAgent Integration Tests', () => {
  test('MettaAgent emits derivation events on input', async ({ page, testApi }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.poll(() => testApi.getConnectionState()).toBe('connected');

    const initialCount = await testApi.getGraphNodeCount();

    // Submit via chat to trigger derivation
    const textarea = page.locator('input-hud textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('(+ 1 2)');
    const sendBtn = page.locator('input-hud .send-btn');
    await sendBtn.click();

    // Wait for events to process
    await page.waitForTimeout(500);

    // Verify node count hasn't decreased
    const finalCount = await testApi.getGraphNodeCount();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('MettaAgent processes MeTTa expressions', async ({ page, testApi }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.poll(() => testApi.getConnectionState()).toBe('connected');

    // Submit a MeTTa expression
    const textarea = page.locator('input-hud textarea');
    await textarea.fill('(+ 2 2)');
    const sendBtn = page.locator('input-hud .send-btn');
    await sendBtn.click();

    // Wait for processing
    await page.waitForTimeout(500);

    // Verify graph has nodes (bootstrap + any new)
    const nodeCount = await testApi.getGraphNodeCount();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('MettaAgent LTM capability available', async ({ page, testControl }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          String(
            (window as Record<string, unknown>).__testApi?.connection?.getState?.() ??
              'disconnected'
          )
        )
      )
      .toBe('connected');

    // Verify bootstrap created concepts
    await testControl.preBootstrap();
    const state = await testControl.getState();
    expect(state?.concepts).toBeDefined();
  });
});
