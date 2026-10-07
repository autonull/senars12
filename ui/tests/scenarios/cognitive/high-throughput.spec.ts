import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test('sustained engine cycles keep the graph live without errors @critical', async ({
  page,
  testApi,
  testControl,
}) => {
  await testControl.loadScenario('bootstrap');
  await waitConnected(testApi);

  for (let i = 0; i < 5; i++) await testControl.step(20);

  await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(0);
  expect(await testApi.getConnectionState()).toBe('connected');
  await expect(page.locator('error-boundary .overlay')).toHaveCount(0);
});