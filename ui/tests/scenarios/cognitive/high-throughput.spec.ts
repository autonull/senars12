import { test } from '../../framework/fixtures/senars-app';
import { simulateHighThroughput } from '../../framework/scenarios/reasoning';

test('UI remains responsive under 50 derivations/sec for 10 seconds', async ({ graph, testControl }) => {
  await simulateHighThroughput(testControl, graph, 50, 10);
});
