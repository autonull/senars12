import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test('admitting new beliefs grows the projected graph @critical', async ({
  testApi,
  testControl,
}) => {
  await testControl.loadScenario('bootstrap');
  await waitConnected(testApi);
  const before = await testApi.getGraphNodeCount();

  await testControl.importBeliefs(['<nova --> star>.', '<star --> celestial>.']);
  await testControl.step(3);

  await expect.poll(() => testApi.getGraphNodeCount()).toBeGreaterThan(before);
});