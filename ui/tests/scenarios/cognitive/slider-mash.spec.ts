import { expect, test } from '../../framework/fixtures/senars-app';

test.describe('Slider Mash: frame budget on rapid truth adjustment', () => {
  test('rapid truth slider changes stay within frame budget', async ({
    page,
    testApi,
    perfMonitor,
  }) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect.async(() => testApi.getConnectionState()).toPass({ timeout: 10000 });

    // Wait for initial graph nodes
    await expect.async(() => testApi.getGraphNodeCount()).toBeGreaterThan(0, { timeout: 15000 });

    // Type a sentence
    const textarea = page.locator('input-hud textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('the sky is blue');
    const sendBtn = page.locator('input-hud .send-btn');
    await sendBtn.click();

    // Wait for node
    await expect
      .async(() => testApi.getAllNodeIds().then((ids: string[]) => ids.length))
      .toBeGreaterThan(0, { timeout: 15000 });

    // Click the first node to open the drawer
    const ids = await testApi.getAllNodeIds();
    const targetId =
      ids.find((id: string) => id.includes('$sky') || id.includes('sky') || id.includes('blue')) ??
      ids[0];
    await testApi.clickNode(targetId);

    // Find the truth slider
    const slider = page.locator('node-detail-drawer input[type="range"]');
    await expect(slider).toBeVisible({ timeout: 3000 });

    // Rapidly mash the slider back and forth (simulating aggressive user input)
    const sliderBox = await slider.boundingBox();
    if (sliderBox) {
      const y = sliderBox.y + sliderBox.height / 2;
      for (let i = 0; i < 10; i++) {
        const x = sliderBox.x + sliderBox.width * (i % 2 === 0 ? 0.2 : 0.8);
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(16); // ~1 frame between changes
      }
    }

    // Verify the node still exists after rapid edits
    const nodeCount = await testApi.getGraphNodeCount();
    expect(nodeCount).toBeGreaterThan(0);

    // PerfMonitor.assertWithinBudget is called automatically in afterEach via the fixture
  });
});
