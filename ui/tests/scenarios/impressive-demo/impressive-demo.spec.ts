import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('impressive demo: live graph + revision history', () => {
  test('bootstrap → graph grows → node click shows history → screenshot', async ({
    testApi,
    testControl,
    page,
  }) => {
    // 1. App loads and connects
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect(page.locator('input-hud')).toBeVisible();

    await expect(async () => {
      const state = await testApi.getConnectionState();
      expect(state).toBe('connected');
    }).toPass({ timeout: 10000 });

    // 2. Initial bootstrap graph present
    await expect(async () => {
      const nodeCount = await testApi.getGraphNodeCount();
      expect(nodeCount).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 5000 });

    const initialNodes = await testApi.getAllNodeIds();
    console.log('Initial nodes:', initialNodes);

    // 3. Inject new derivations to grow the graph (simulates Narsese input)
    await testControl.injectDerivation('<cat --> mammal>', 0.8, 0.9);
    await testControl.injectDerivation('<dog --> mammal>', 0.75, 0.85);

    // 4. Graph grows with new nodes + relation edges
    await expect(async () => {
      const nodeCount = await testApi.getGraphNodeCount();
      expect(nodeCount).toBeGreaterThanOrEqual(initialNodes.length + 2);
    }).toPass({ timeout: 5000 });

    const grownNodes = await testApi.getAllNodeIds();
    console.log('Grown nodes:', grownNodes);

    // 5. Click a bootstrap node that has revision history (e.g., 'bird' or 'animal')
    const targetNode = grownNodes.find((n) => n === 'bird' || n === 'animal' || n.includes('bird'));
    if (!targetNode) throw new Error('No target node found for history test');
    console.log('Clicking node:', targetNode);

    await testApi.clickNode(targetNode);

    // 6. Drawer opens — verify via test API store state or DOM
    // The drawer is a Lit component; check it's rendered
    await expect(page.locator('node-detail-drawer')).toBeVisible();

    // 7. Switch to History tab via test API store (or DOM click)
    // Use the test API to get the selected node's history from store
    await expect(async () => {
      const historyState = await testApi.getStoreState('nodeHistory');
      console.log('History state:', historyState);
      // History should be non-empty string (JSON array)
      expect(historyState).not.toBe('[]');
      expect(historyState).not.toBe('""');
    }).toPass({ timeout: 5000 });

    // 8. Screenshot the impressive state
    await page.screenshot({
      path: 'test-results/impressive-demo.png',
      fullPage: true,
    });

    console.log('✅ Impressive demo screenshot saved to test-results/impressive-demo.png');
  });
});