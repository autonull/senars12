import { test } from '../../framework/fixtures/senars-app';
import { simulateHighThroughput } from '../../framework/scenarios/reasoning';

test('UI remains responsive under 50 derivations/sec for 30 seconds', async ({ graph, ws }) => {
  await simulateHighThroughput(ws, graph, 50, 30);
});
