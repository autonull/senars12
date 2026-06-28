import { test, expect } from '../../framework/fixtures/senars-app';
import { seedGraph, triggerDerivation } from '../../framework/scenarios/reasoning';

test('belief graph updates when NARS derives new conclusions', async ({ graph, testControl }) => {
  await seedGraph(testControl, graph, [
    { term: 'bird', f: 0.9, c: 0.9 },
    { term: 'fly', f: 0.8, c: 0.85 },
    { term: 'animal', f: 0.95, c: 0.95 },
  ]);

  const initialCount = await graph.getNodeCount();
  expect(initialCount).toBeGreaterThan(0);

  await triggerDerivation(testControl, graph, 'bird2', 0.85);

  const newCount = await graph.getNodeCount();
  expect(newCount).toBeGreaterThan(initialCount);

  const data = await graph.getNodeData('bird2');
  expect(data).not.toBeNull();
  expect(data.priority).toBeGreaterThan(0);
});
