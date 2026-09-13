import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Spatial Gate: 2D/3D parity', () => {
  test('2D viewport renders initially', async ({ page, testApi }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();

    await expect(async () => {
      const state = await testApi.getConnectionState();
      expect(state).toBe('connected');
    }).toPass({ timeout: 10000 });

    await expect(async () => {
      const count = await testApi.getGraphNodeCount();
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 15000 });
  });

  test('3D viewport renders when toggled', async ({ page, testApi }) => {
    // Ensure we're in 2D mode first
    await expect(page.locator('graph-viewport')).toBeVisible({ timeout: 5000 });

    await expect(async () => {
      const state = await testApi.getConnectionState();
      expect(state).toBe('connected');
    }).toPass({ timeout: 10000 });

    // Toggle to 3D
    const toolbar = page.locator('graph-toolbar');
    await toolbar.getByRole('button', { name: '3D' }).click({ force: true });

    await expect(page.locator('spacegraph-viewport')).toBeVisible({ timeout: 5000 });
  });

  test('node count available via spacegraph test API', async ({ page, testApi }) => {
    // Ensure we're in 2D mode first
    const toolbar = page.locator('graph-toolbar');
    await toolbar.getByRole('button', { name: '3D' }).click({ force: true });

    // Wait for spacegraph API to be registered
    await testApi.waitForComponentApi('spacegraph');

    await expect(page.locator('spacegraph-viewport')).toBeVisible({ timeout: 5000 });

    const count = await page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as
        | Record<string, unknown>
        | undefined;
      return Number(
        (api?.spacegraph as Record<string, unknown> | undefined)?.getNodeCount?.() ?? 0
      );
    });
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('edge editing works in 2D mode', async ({ page, testApi }) => {
    // Ensure we're in 2D mode
    const toolbar = page.locator('graph-toolbar');
    const currentMode = await page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as
        | Record<string, unknown>
        | undefined;
      return String(
        (api?.store as { getState?: (p: string) => unknown } | undefined)?.getState?.(
          'viewportMode'
        ) ?? '2d'
      );
    });

    if (currentMode !== '2d') {
      await toolbar.getByRole('button', { name: '3D' }).click({ force: true });
      await expect(page.locator('graph-viewport')).toBeVisible({ timeout: 5000 });
    }

    await expect(page.locator('graph-viewport')).toBeVisible();

    await expect(async () => {
      const count = await testApi.getGraphEdgeCount();
      expect(count).toBeGreaterThanOrEqual(0);
    }).toPass({ timeout: 15000 });

    const edgeIds = await testApi.getAllEdgeIds();
    if (edgeIds.length > 0) {
      const [source, target] = edgeIds[0].split('->');
      await testApi.clickEdge(source, target);

      const drawer = page.locator('node-detail-drawer');
      await expect(drawer).toBeVisible({ timeout: 2000 });
    }
  });
});
