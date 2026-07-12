import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('screenshot verification: live graph + revision history', () => {
  test('captures the impressive demo: graph + history', async ({ page }) => {
    // 1. Load the app - this also verifies server is up
    await page.goto(BASE_URL);
    await page.waitForSelector('graph-viewport', { timeout: 15000 });
    await page.waitForSelector('input-hud', { timeout: 10000 });

    // 2. Wait for WebSocket connection and initial graph
    await page.waitForFunction(
      () => (window as Record<string, unknown>).__testApi !== undefined,
      { timeout: 15000 }
    );

    await page.waitForFunction(
      () => {
        const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
        return api?.connection?.getState?.() === 'connected';
      },
      { timeout: 10000 }
    );

    // 3. Verify initial nodes via test API
    const initialNodeCount = await page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return Number(api?.graph?.getNodeCount?.() ?? 0);
    });
    console.log('Initial node count:', initialNodeCount);
    expect(initialNodeCount).toBeGreaterThanOrEqual(5);

    // 4. Get all node IDs and pick one with revision history (bird, animal, etc.)
    const allNodes = await page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return (api?.graph?.getAllNodeIds?.() ?? []) as string[];
    });
    console.log('All nodes:', allNodes);

    const targetNode = allNodes.find(n => n === 'bird' || n === 'animal' || n.includes('bird'));
    expect(targetNode).toBeTruthy();
    console.log('Target node for history:', targetNode);

    // 5. Click the node via test API
    await page.evaluate((id) => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      api?.graph?.clickNode?.(id);
    }, targetNode);

    // 6. Wait for drawer to open
    await page.waitForSelector('node-detail-drawer', { timeout: 5000 });

    // 7. Click the History tab (inside shadow DOM)
    await page.locator('node-detail-drawer >> button:has-text("History")').click();

    // 8. Wait for history to populate (from real NAR revision log)
    await page.waitForFunction(
      () => {
        const drawer = document.querySelector('node-detail-drawer');
        if (!drawer || !drawer.shadowRoot) return false;
        const content = drawer.shadowRoot.querySelector('.content');
        return content && content.textContent?.includes?.('Revision History') && 
               !content.textContent?.includes?.('No history available');
      },
      { timeout: 10000 }
    );

    // 9. Also verify store-level nodeHistory is populated
    const historyState = await page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return String(api?.store?.getState?.('nodeHistory') ?? '');
    });
    console.log('Store nodeHistory:', historyState);
    expect(historyState).not.toBe('[]');
    expect(historyState).not.toBe('""');

    // 10. Take the impressive screenshot
    await page.screenshot({
      path: 'test-results/impressive-demo.png',
      fullPage: true,
    });

    console.log('✅ Screenshot saved: test-results/impressive-demo.png');
  });
});