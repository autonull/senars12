import { expect, test } from '../../framework/fixtures/senars-app';
import { waitConnected } from '../../framework/utils/interactions';

test('two premises fuse into a derived conclusion with edges @critical', async ({
  testApi,
  testControl,
}) => {
  await testControl.loadScenario('basic-derivation');
  await waitConnected(testApi);

  await expect
    .poll(() => testApi.getAllNodeIds())
    .toEqual(expect.arrayContaining(['(bird-->animal)', '(robin-->bird)', '(robin-->animal)']));

  const conclusion = await testApi.getNodeData('(robin-->animal)');
  const truth = conclusion.truth as { confidence?: number } | undefined;
  expect(Number(truth?.confidence)).toBeGreaterThan(0);

  await expect
    .poll(async () =>
      (await testApi.getAllEdgeIds()).some((id) => id.endsWith('->(robin-->animal)'))
    )
    .toBe(true);
});