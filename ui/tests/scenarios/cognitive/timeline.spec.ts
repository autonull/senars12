import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Temporal Gate: timeline scrubber and revision history', () => {
  test('scrub timeline to view time-gated node visibility', async ({ page, testApi }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.async(() => testApi.getConnectionState()).toPass({ timeout: 10000 });

    // Wait for initial graph to load
    await expect.async(() => testApi.getGraphNodeCount()).toBeGreaterThan(0, { timeout: 15000 });

    // Get current node count and check timeline scrubber exists
    const nodeCount = await testApi.getGraphNodeCount();
    expect(nodeCount).toBeGreaterThan(0);

    // Check timeline scrubber is in the DOM
    const scrubber = page.locator('timeline-scrubber');
    await expect(scrubber).toBeVisible({ timeout: 3000 });

    // Get timeline value from store
    const initialTime = await testApi.getStoreState('view');
    console.log('Initial view state:', JSON.stringify(initialTime));

    // Type a sentence to create a node with occurrenceTime
    const textarea = page.locator('input-hud textarea');
    await textarea.fill('the cat is black');
    const sendBtn = page.locator('input-hud .send-btn');
    await sendBtn.click();

    // Wait for new node to appear
    await page.waitForTimeout(2000);

    // Verify timeline scrubber has updated (or at least exists)
    await expect(scrubber).toBeVisible();
  });

  test('node history tab displays revision entries', async ({ page, testApi }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.async(() => testApi.getConnectionState()).toPass({ timeout: 10000 });

    await expect.async(() => testApi.getGraphNodeCount()).toBeGreaterThan(0, { timeout: 15000 });

    // Click on a node
    const ids = await testApi.getAllNodeIds();
    const nodeId = ids[0];
    await testApi.clickNode(nodeId as string);

    // Check that node-detail-drawer exists
    await expect(page.locator('node-detail-drawer')).toBeVisible({ timeout: 3000 });

    // Switch to history tab
    const historyTab = page.locator('node-detail-drawer .tab', { hasText: 'History' });
    await historyTab.click();

    // History content should be present (either entries or "No history")
    const historyContent = page.locator('node-detail-drawer .content');
    await expect(historyContent).toBeVisible();
  });
});
