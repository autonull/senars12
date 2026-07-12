import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Relational Gate: auto-link', () => {
  test('multi-clause Narsese input produces multiple nodes and edges', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.poll(() => testApi.getConnectionState()).toBe('connected', { timeout: 10000 });

    // Wait for initial graph nodes to load
    await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(0, { timeout: 15000 });

    const initialNodeCount = await testApi.getGraphNodeCount();
    const initialEdgeCount = await testApi.getGraphEdgeCount();

    // Send multi-clause input that NAR can parse as Narsese
    const textarea = page.locator('input-hud textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    // <bird --> animal> ; <robin --> bird> creates an inheritance chain
    await textarea.type('<bird --> animal>. ; <robin --> bird>.');
    await page.keyboard.press('Enter');

    // Wait for new nodes to appear (at least 2 new concepts)
    await expect
      .poll(() => testApi.getGraphNodeCount())
      .toBeGreaterThan(initialNodeCount + 1, { timeout: 15000 });

    // Wait for edges to appear (at least 1 new edge from inheritance)
    await expect
      .poll(() => testApi.getGraphEdgeCount())
      .toBeGreaterThan(initialEdgeCount, { timeout: 15000 });

    // Verify at least 2 additional nodes were added
    const finalNodeCount = await testApi.getGraphNodeCount();
    expect(finalNodeCount).toBeGreaterThanOrEqual(initialNodeCount + 2);

    // Verify at least 1 edge auto-created (inheritance links)
    const finalEdgeCount = await testApi.getGraphEdgeCount();
    expect(finalEdgeCount).toBeGreaterThanOrEqual(initialEdgeCount + 1);
  });

  test('NL multi-clause sentence produces concepts via NL understanding', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.poll(() => testApi.getConnectionState()).toBe('connected', { timeout: 10000 });

    await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(0, { timeout: 15000 });

    const initialCount = await testApi.getGraphNodeCount();

    // Type a relational sentence
    const textarea = page.locator('input-hud textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.type('cats are animals and dogs are animals');
    await page.keyboard.press('Enter');

    // Wait for the graph to grow
    await expect
      .poll(() => testApi.getGraphNodeCount())
      .toBeGreaterThan(initialCount, { timeout: 30000 });

    const newCount = await testApi.getGraphNodeCount();
    expect(newCount).toBeGreaterThan(initialCount);
  });
});
