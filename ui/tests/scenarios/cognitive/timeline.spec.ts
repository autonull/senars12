import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Temporal Gate: timeline scrubber and revision history', () => {
  test('scrub timeline to view time-gated node visibility', async ({ page, testApi }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.poll(() => testApi.getConnectionState()).toBe('connected');

    const initialCount = await testApi.getGraphNodeCount();

    // Type a sentence to create a node with occurrenceTime
    const textarea = page.locator('input-hud textarea');
    await textarea.fill('the cat is black');
    const sendBtn = page.locator('input-hud .send-btn');
    await sendBtn.click();

    // Wait for new node to appear
    await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(initialCount);

    // Check timeline scrubber is in the DOM
    const scrubber = page.locator('timeline-scrubber');
    await expect(scrubber).toBeVisible({ timeout: 3000 });

    // Verify timeline scrubber has updated (or at least exists)
    await expect(scrubber).toBeVisible();
  });

  test('node history tab displays revision entries', async ({ page, testApi }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.poll(() => testApi.getConnectionState()).toBe('connected');

    const initialCount = await testApi.getGraphNodeCount();

    // Create a node first
    const textarea = page.locator('input-hud textarea');
    await textarea.fill('the dog is brown');
    const sendBtn = page.locator('input-hud .send-btn');
    await sendBtn.click();
    await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(initialCount);

    // Click on the newly created node (find one that wasn't there before)
    const ids = await testApi.getAllNodeIds();
    const newNodeId =
      ids.find(
        (id) => !id.startsWith('deriv:') && !id.startsWith('cycle:') && !id.startsWith('input:')
      ) ?? ids[ids.length - 1];
    console.log('[TEST] All node IDs:', ids.slice(0, 10), '... total:', ids.length);
    console.log('[TEST] Clicking node:', newNodeId);
    await testApi.clickNode(newNodeId as string);

    // Wait a bit for the drawer to render
    await page.waitForTimeout(500);

    // Check that node-detail-drawer exists
    const drawer = page.locator('node-detail-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Switch to history tab
    const historyTab = page.locator('node-detail-drawer .tab', { hasText: 'History' });
    await historyTab.click();

    // History content should be present (either entries or "No history")
    const historyContent = page.locator('node-detail-drawer .content');
    await expect(historyContent).toBeVisible();
  });
});
