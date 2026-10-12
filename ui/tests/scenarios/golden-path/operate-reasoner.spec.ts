import { expect, test } from '../../framework/fixtures/senars-app';
import { setComposerMode, sendMessage, waitConnected } from '../../framework/utils/interactions';

/**
 * The golden path (P2): the essential reasoning loop, driven through the real
 * app on a deterministic Narsese path (no LM). assert → ask → answer → why →
 * steer → observe. Every step is a real affordance; nothing is poked past the
 * UI except enabling the Reasoning composition (the same seam the HUD uses).
 */
test('the operator can assert, ask, see why, and steer — on the real app @golden', async ({
  page,
  testApi,
}) => {
  test.setTimeout(90_000);
  await waitConnected(testApi);

  // Reasoning is a composition, off by default; enable it as the HUD would.
  await page.evaluate(() => {
    const api = (window as unknown as { __testApi?: { capabilities?: { enable: (id: string) => void } } })
      .__testApi;
    api?.capabilities?.enable('reasoning');
  });
  await expect(page.locator('bottom-bar .modes button[data-mode="believe"]')).toBeVisible();

  // ASSERT — submit Narsese over the control path; each becomes a node. The
  // terms are self-contained so the flow never depends on a prior scenario.
  await setComposerMode(page, 'believe');
  await sendMessage(page, '<bird --> animal>.');
  await expect.poll(() => testApi.getAllNodeIds(), { timeout: 30000 }).toContain('(bird-->animal)');
  await sendMessage(page, '<finch --> bird>.');
  await expect.poll(() => testApi.getAllNodeIds(), { timeout: 30000 }).toContain('(finch-->bird)');

  // ASK — one action; the engine admits, reasons and answers.
  await setComposerMode(page, 'question');
  await sendMessage(page, '<finch --> animal>?');

  // ANSWER — the deduction surfaces as its own node.
  await expect.poll(() => testApi.getAllNodeIds(), { timeout: 30000 }).toContain('(finch-->animal)');

  // WHY — selecting the answer offers its proof in one click (no modifier).
  await testApi.clickNode('(finch-->animal)');
  const why = page.locator('node-detail-drawer [data-action="why"]');
  await expect(why).toBeVisible({ timeout: 30000 });

  // OBSERVE — the proof opens in the explain overlay.
  await why.click();
  await expect(page.locator('s-explain')).toBeVisible();

  // STEER — control mode exposes the engine controls; a step advances the graph.
  await page.locator('bottom-bar .control-mode-btn').click();
  await expect(page.locator('bottom-bar .step-btn')).toBeVisible();
  await page.locator('bottom-bar .step-btn').click();
  await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(0);

  // RESOLVE — retract the asserted premise from the same surface (Flow C).
  await testApi.clickNode('(finch-->bird)');
  await page.locator('node-detail-drawer .tab', { hasText: 'actions' }).click();
  await page.locator('node-detail-drawer [data-action="retract"]').click();
  await expect
    .poll(() => testApi.getAllNodeIds(), { timeout: 30000 })
    .not.toContain('(finch-->bird)');
});