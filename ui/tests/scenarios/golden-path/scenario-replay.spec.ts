import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

/**
 * G6: replay a canonical scenario (`ui/src/server/scenarios.ts`) in the live app
 * and walk its provenance. The scenario runs through the real engine via the test
 * endpoint, then the conclusion is inspected through the same views a person uses.
 */
test('a canonical scenario replays through the live views @golden', async ({
  page,
  testApi,
  testControl,
}) => {
  test.setTimeout(90_000);
  await waitConnected(testApi);

  // S1: <bird --> animal>. <robin --> bird>. + 5 cycles ⇒ robin is an animal.
  // The scenario runs while the client is connected, so its derivation records
  // stream live rather than being missed by a reconnect.
  await testControl.loadScenario('basic-derivation');

  await expect.poll(() => testApi.getAllNodeIds(), { timeout: 30000 }).toContain('(robin-->animal)');

  // The derived conclusion carries its proof: the inspector offers "Why?".
  await testApi.clickNode('(robin-->animal)');
  await expect(page.locator('node-detail-drawer [data-action="why"]')).toBeVisible({
    timeout: 30000,
  });
});