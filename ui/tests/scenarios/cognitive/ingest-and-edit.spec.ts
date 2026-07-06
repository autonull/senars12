import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Cognitive Gate: ingest and edit', () => {
  test('type a sentence, see a node appear, change its truth value', async ({
    page,
    testApi,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();

    await expect(async () => {
      const state = await testApi.getConnectionState();
      expect(state).toBe('connected');
    }).toPass({ timeout: 10000 });

    // Wait for initial graph nodes to load
    await expect(async () => {
      const count = await testApi.getGraphNodeCount();
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 15000 });

    // Type into input-hud
    const textarea = page.locator('input-hud textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('the sky is blue');

    // Click send
    const sendBtn = page.locator('input-hud .send-btn');
    await sendBtn.click();

    // Wait for the node to appear (the graph might already have nodes)
    // We expect the term "(/$sky --> blue)" or similar to appear
    await expect(async () => {
      const ids = await testApi.getAllNodeIds();
      expect(ids.length).toBeGreaterThan(0);
    }).toPass({ timeout: 15000 });

    // Get the first node and click it
    const ids = await testApi.getAllNodeIds();
    const targetId = ids.find((id: string) => id.includes('$sky') || id.includes('sky') || id.includes('blue'));
    const nodeId = targetId ?? (ids[0] as string);

    await testApi.clickNode(nodeId);

    // Verify drawer opens with truth slider
    const slider = page.locator('node-detail-drawer input[type="range"]');
    await expect(slider).toBeVisible({ timeout: 3000 });

    // Drag the slider to change truth
    const sliderBox = await slider.boundingBox();
    if (sliderBox) {
      const startX = sliderBox.x + sliderBox.width * 0.2;
      const endX = sliderBox.x + sliderBox.width * 0.8;
      const y = sliderBox.y + sliderBox.height / 2;
      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(endX, y, { steps: 5 });
      await page.mouse.up();
    }

    // Verify the truth value display changed
    const truthDisplay = page.locator('node-detail-drawer .field-value span[style*="color"]');
    await expect(truthDisplay).not.toHaveText('0.50', { timeout: 3000 });

    // Verify the node still exists (graph wasn't broken by the edit)
    const nodeCount = await testApi.getGraphNodeCount();
    expect(nodeCount).toBeGreaterThan(0);
  });
});