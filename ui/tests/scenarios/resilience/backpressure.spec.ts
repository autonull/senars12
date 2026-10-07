import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test('a burst of engine events does not wedge the client @critical', async ({
  page,
  testApi,
  testControl,
}) => {
  await testControl.loadScenario('bootstrap');
  await waitConnected(testApi);
  const before = await testApi.getGraphNodeCount();

  await testControl.importBeliefs(
    Array.from({ length: 20 }, (_, i) => `<n${i} --> thing>.`)
  );
  await testControl.step(20);

  await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(before);
  expect(await testApi.getConnectionState()).toBe('connected');
  await expect(page.locator('error-boundary .overlay')).toHaveCount(0);
});