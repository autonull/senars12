import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Relational Gate: edit edge', () => {
  test('tap an edge, change its type via the drawer, verify update', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect
      .async(() => testApi.getConnectionState())
      .toPass({ timeout: 10000 });

    // Wait for graph to have nodes and edges
    await expect
      .async(() => testApi.getGraphNodeCount())
      .toBeGreaterThan(0, { timeout: 15000 });

    await expect
      .async(() => testApi.getGraphEdgeCount())
      .toBeGreaterThan(0, { timeout: 15000 });

    // Get the first edge
    const edgeIds = await testApi.getAllEdgeIds();
    expect(edgeIds.length).toBeGreaterThan(0);

    const firstEdgeId = edgeIds[0] as string;
    const [source, target] = firstEdgeId.split('->');

    // Get the edge data before editing
    const edgeDataBefore = await testApi.getEdgeData(source, target);
    expect(edgeDataBefore).not.toBeNull();

    // Click the edge to select it
    await testApi.clickEdge(source, target);

    // Verify drawer opens with edge tab
    const edgeTab = page.locator('node-detail-drawer .tab-button', { hasText: 'Edge' });
    await expect(edgeTab).toBeVisible({ timeout: 3000 });
    await edgeTab.click();

    // Verify edge type selector is visible
    const typeSelect = page.locator('node-detail-drawer select');
    await expect(typeSelect).toBeVisible({ timeout: 3000 });

    // Change the edge type to 'similarity'
    const currentType = await typeSelect.inputValue();
    const newType = currentType === 'similarity' ? 'inheritance' : 'similarity';
    await typeSelect.selectOption(newType);

    // Verify the drawer shows the updated type
    await expect(typeSelect).toHaveValue(newType, { timeout: 3000 });
  });

  test('background tap clears edge selection', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect
      .async(() => testApi.getConnectionState())
      .toPass({ timeout: 10000 });

    await expect
      .async(() => testApi.getGraphEdgeCount())
      .toBeGreaterThan(0, { timeout: 15000 });

    const edgeIds = await testApi.getAllEdgeIds();
    const [source, target] = (edgeIds[0] as string).split('->');

    // Click the edge
    await testApi.clickEdge(source, target);

    // Verify drawer is open
    const drawer = page.locator('node-detail-drawer');
    await expect(drawer).toBeVisible({ timeout: 3000 });

    // Click background to clear selection
    await page.locator('graph-viewport #cy-container').click({ position: { x: 10, y: 10 } });

    // Verify edge selection is cleared
    const selectedEdgeId = await testApi.getStoreState('selectedEdgeId');
    expect(selectedEdgeId).toBeNull();
  });
});
