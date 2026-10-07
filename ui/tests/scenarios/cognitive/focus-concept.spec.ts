import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test('focusing a derived concept sets focus and opens its inspector @critical', async ({
  page,
  testApi,
  testControl,
}) => {
  await testControl.loadScenario('basic-derivation');
  await waitConnected(testApi);
  await expect.poll(() => testApi.getAllNodeIds()).toContain('(robin-->animal)');
  // Wait for the cytoscape element itself, then click (retrying through syncGraph rebuilds).
  await expect.poll(() => testApi.getNodeData('(robin-->animal)')).not.toBeNull();
  await expect
    .poll(async () => {
      await testApi.clickNode('(robin-->animal)');
      return testApi.getStoreState('selectedNodeId');
    })
    .toBe('(robin-->animal)');
  const drawer = page.locator('node-detail-drawer');
  await expect(drawer).toBeVisible();

  await drawer.locator('.tab', { hasText: 'Actions' }).click();
  await drawer.locator('.action-btn', { hasText: 'Focus Term' }).click();

  await expect.poll(() => testApi.getStoreState('focusTerm')).toBe('(robin-->animal)');
});