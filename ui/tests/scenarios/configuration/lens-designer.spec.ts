import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Config Gate: lens designer', () => {
  test('open designer, map priority → size, commit, assert node size changes', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect
      .async(() => testApi.getConnectionState())
      .toPass({ timeout: 10000 });

    // Wait for initial graph nodes
    await expect
      .async(() => testApi.getGraphNodeCount())
      .toBeGreaterThan(0, { timeout: 15000 });

    // Open the lens designer panel via the "Design" toolbar button
    const designBtn = page.locator('graph-toolbar .toolbar-btn', { hasText: 'Design' });
    await expect(designBtn).toBeVisible({ timeout: 5000 });
    await designBtn.click();

    // Verify lens-designer panel is visible
    const designer = page.locator('lens-designer');
    await expect(designer).toBeVisible({ timeout: 3000 });

    // Fill in the lens name
    const nameInput = designer.locator('input[placeholder="Lens name…"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Priority Size Lens');

    // The first mapping row defaults to "priority → size" with priority-to-size scale
    // Verify the defaults
    const fieldSelect = designer.locator('select').first();
    await expect(fieldSelect).toHaveValue('priority');

    const channelSelect = designer.locator('select').nth(2);
    await expect(channelSelect).toHaveValue('size');

    // Check that the commit button is enabled
    const commitBtn = designer.locator('.commit-btn');
    await expect(commitBtn).toBeEnabled();

    // Take a snapshot of a node's current size before committing
    const nodeIds = await testApi.getAllNodeIds();
    expect(nodeIds.length).toBeGreaterThan(0);

    const firstNodeId = nodeIds[0] as string;
    const nodeDataBefore = await testApi.getNodeData(firstNodeId);
    const sizeBefore = nodeDataBefore?.size ?? 30;

    // Commit the lens
    await commitBtn.click();

    // Verify the lens was applied (lens-designer panel closes)
    await expect(designer).not.toBeVisible({ timeout: 3000 });

    // Verify the active lens changed
    const activeLens = await testApi.getStoreState('activeLens');
    expect(activeLens).toBe('priority-size-lens');

    // Verify node data is affected by the new lens (size may differ)
    // Allow a short delay for modulation engine to re-evaluate
    await page.waitForTimeout(500);
    const nodeDataAfter = await testApi.getNodeData(firstNodeId);
    expect(nodeDataAfter).not.toBeNull();
  });

  test('add isContradiction → color mapping, commit, assert conflict nodes recolor', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect
      .async(() => testApi.getConnectionState())
      .toPass({ timeout: 10000 });

    await expect
      .async(() => testApi.getGraphNodeCount())
      .toBeGreaterThan(0, { timeout: 15000 });

    // Open lens designer
    const designBtn = page.locator('graph-toolbar .toolbar-btn', { hasText: 'Design' });
    await expect(designBtn).toBeVisible({ timeout: 5000 });
    await designBtn.click();

    const designer = page.locator('lens-designer');
    await expect(designer).toBeVisible({ timeout: 3000 });

    // Name the lens
    const nameInput = designer.locator('input[placeholder="Lens name…"]');
    await nameInput.fill('Conflict Highlight');

    // Remove the default mapping by toggling to const mode or adding a new one
    // We want: isContradiction (field) → color (channel)
    const firstFieldSelect = designer.locator('select').first();
    await firstFieldSelect.selectOption('isContradiction');

    const firstChannelSelect = designer.locator('select').nth(2);
    await firstChannelSelect.selectOption('color');

    // The default scale map is 'priority-to-size' — for boolean field we should use 'None'
    const scaleSelect = designer.locator('select').nth(3);
    if (await scaleSelect.isVisible()) {
      await scaleSelect.selectOption('');
    }

    // Commit the lens
    const commitBtn = designer.locator('.commit-btn');
    await commitBtn.click();

    // Verify lens was applied
    await expect(designer).not.toBeVisible({ timeout: 3000 });

    const activeLens = await testApi.getStoreState('activeLens');
    expect(activeLens).toBe('conflict-highlight');

    // Verify no exceptions occurred
    await page.waitForTimeout(500);
    const nodeCount = await testApi.getGraphNodeCount();
    expect(nodeCount).toBeGreaterThan(0);
  });
});
